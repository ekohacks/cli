const API = 'https://api.linear.app/graphql';

export interface Story {
  identifier: string;
  title: string;
  description: string | null;
  completedAt: string | null;
  estimate: number | null;
  labels: string[];
}

export interface StoryRef {
  id: string;
  identifier: string;
}

export type CreateStoryOptions = {
  teamId: string;
  title: string;
  description?: string;
  parentId?: string;
};

export interface CreatedStory {
  id: string;
  identifier: string;
  url: string;
}

type Envelope = { data?: unknown; errors?: { message: string }[] };
type Post = (body: { query: string; variables?: Record<string, unknown> }) => Promise<Envelope>;

type RawStory = {
  identifier: string;
  title: string;
  description: string | null;
  completedAt: string | null;
  estimate: number | null;
  labels: { nodes: { name: string }[] };
};

const STORIES_PAGE = `query StoriesPage($team: String!, $column: String!, $after: String) {
  issues(
    filter: { team: { key: { eq: $team } }, state: { name: { eq: $column } } }
    first: 100
    after: $after
    orderBy: updatedAt
  ) {
    pageInfo { hasNextPage endCursor }
    nodes { identifier title description completedAt estimate labels { nodes { name } } }
  }
}`;

// No cursor here on purpose: archived stories drop out of default query results, so the
// archive loop re-fetches this first page until it comes back empty.
const STORY_IDS = `query StoryIds($team: String!, $column: String!) {
  issues(
    filter: { team: { key: { eq: $team } }, state: { name: { eq: $column } } }
    first: 100
  ) {
    nodes { id identifier }
  }
}`;

const TEAM_ID = `query TeamId($key: String!) {
  teams(filter: { key: { eq: $key } }) { nodes { id } }
}`;

const CREATE_STORY = `mutation CreateStory($input: IssueCreateInput!) {
  issueCreate(input: $input) { issue { id identifier url } }
}`;

// Wraps the Linear surface the stories commands need, behind the one GraphQL endpoint.
// Real and null share every line above the bottom layer: create() posts to api.linear.app
// with the key from the environment, createNull() answers GraphQL-shaped envelopes from
// configured state and never opens a socket; the real side is proven against a real board
// rather than a faked Linear. idRounds configures successive answers to storyIds(): each
// call takes the next round and the last round repeats, so a test can walk a column down
// to empty. archiveRounds configures how many archives succeed per call; beyond the list,
// all of them do.
export class LinearWrapper {
  static create({
    apiKey = process.env.LINEAR_API_KEY ?? '',
  }: { apiKey?: string } = {}): LinearWrapper {
    return new LinearWrapper(async (body) => {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: apiKey },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`linear answered ${response.status}: ${await response.text()}`);
      }
      return (await response.json()) as Envelope;
    });
  }

  static createNull({
    pages = [[]],
    idRounds = [[]],
    archiveRounds = [],
    teams = {},
  }: {
    pages?: Story[][];
    idRounds?: StoryRef[][];
    archiveRounds?: number[];
    teams?: Record<string, string>;
  } = {}): LinearWrapper {
    let idRound = 0;
    let archiveRound = 0;
    let minted = 0;
    return new LinearWrapper((body) => {
      const answer = (data: unknown): Promise<Envelope> => Promise.resolve({ data });
      if (body.query.includes('issueCreate')) {
        minted += 1;
        const issue = {
          id: `null-issue-${minted}`,
          identifier: `NULL-${minted}`,
          url: `https://linear.app/nulled/issue/NULL-${minted}`,
        };
        return answer({ issueCreate: { issue } });
      }
      if (body.query.includes('issueArchive')) {
        const calls = body.query.match(/issueArchive/g) ?? [];
        const index = archiveRound;
        archiveRound += 1;
        const successes = archiveRounds[index] ?? calls.length;
        return answer(
          Object.fromEntries(calls.map((_, i) => [`a${i}`, { success: i < successes }])),
        );
      }
      if (body.query.includes('teams(')) {
        const id = teams[body.variables?.key as string];
        return answer({ teams: { nodes: id === undefined ? [] : [{ id }] } });
      }
      if (body.query.includes('pageInfo')) {
        const after = body.variables?.after as string | null;
        const index = after === null ? 0 : Number(after.replace('cursor-', ''));
        const hasNextPage = index < pages.length - 1;
        return answer({
          issues: {
            pageInfo: { hasNextPage, endCursor: hasNextPage ? `cursor-${index + 1}` : null },
            nodes: (pages[index] ?? []).map((story) => ({
              ...story,
              labels: { nodes: story.labels.map((name) => ({ name })) },
            })),
          },
        });
      }
      const round = Math.min(idRound, idRounds.length - 1);
      idRound += 1;
      return answer({ issues: { nodes: idRounds[round] ?? [] } });
    });
  }

  private readonly post: Post;

  private constructor(post: Post) {
    this.post = post;
  }

  private async query(query: string, variables?: Record<string, unknown>): Promise<unknown> {
    const envelope = await this.post({ query, variables });
    if (envelope.errors !== undefined && envelope.errors.length > 0) {
      throw new Error(
        `linear answered: ${envelope.errors.map((error) => error.message).join('; ')}`,
      );
    }
    return envelope.data;
  }

  async storiesPage({
    team,
    column,
    after,
  }: {
    team: string;
    column: string;
    after?: string;
  }): Promise<{ stories: Story[]; nextCursor?: string }> {
    const data = (await this.query(STORIES_PAGE, { team, column, after: after ?? null })) as {
      issues: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: RawStory[];
      };
    };
    const stories = data.issues.nodes.map((node) => ({
      identifier: node.identifier,
      title: node.title,
      description: node.description,
      completedAt: node.completedAt,
      estimate: node.estimate,
      labels: node.labels.nodes.map((label) => label.name),
    }));
    const { hasNextPage, endCursor } = data.issues.pageInfo;
    return hasNextPage && endCursor !== null ? { stories, nextCursor: endCursor } : { stories };
  }

  async storyIds({ team, column }: { team: string; column: string }): Promise<StoryRef[]> {
    const data = (await this.query(STORY_IDS, { team, column })) as {
      issues: { nodes: StoryRef[] };
    };
    return data.issues.nodes;
  }

  private readonly archiveTrackers: string[][][] = [];

  trackArchives(): { data: string[][] } {
    const tracker: string[][] = [];
    this.archiveTrackers.push(tracker);
    return { data: tracker };
  }

  // Aliases let one request carry many issueArchive calls — a0, a1, a2 and so on — so a
  // page of a hundred costs four requests instead of a hundred. The ids interpolated into
  // the mutation are UUIDs the API itself answered, never user input.
  async archive(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    const calls = ids.map(
      (id, index) => `a${index}: issueArchive(id: ${JSON.stringify(id)}) { success }`,
    );
    const data = (await this.query(`mutation { ${calls.join(' ')} }`)) as Record<
      string,
      { success: boolean }
    >;
    for (const tracker of this.archiveTrackers) {
      tracker.push(ids);
    }
    return Object.values(data).filter((entry) => entry.success).length;
  }

  async teamId(key: string): Promise<string | undefined> {
    const data = (await this.query(TEAM_ID, { key })) as { teams: { nodes: { id: string }[] } };
    return data.teams.nodes[0]?.id;
  }

  private readonly createTrackers: CreateStoryOptions[][] = [];

  trackCreates(): { data: CreateStoryOptions[] } {
    const tracker: CreateStoryOptions[] = [];
    this.createTrackers.push(tracker);
    return { data: tracker };
  }

  async createStory(options: CreateStoryOptions): Promise<CreatedStory> {
    const input: Record<string, string> = { teamId: options.teamId, title: options.title };
    if (options.description !== undefined) {
      input.description = options.description;
    }
    if (options.parentId !== undefined) {
      input.parentId = options.parentId;
    }
    const data = (await this.query(CREATE_STORY, { input })) as {
      issueCreate: { issue: CreatedStory };
    };
    for (const tracker of this.createTrackers) {
      tracker.push(options);
    }
    return data.issueCreate.issue;
  }
}
