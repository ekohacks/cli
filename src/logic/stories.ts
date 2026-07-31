import type { LinearWrapper, Story } from '../infrastructure/linear.ts';

export type ArchiveResult = { archived: number } | { stopped: string };
export type CreateResult = { created: number } | { stopped: string };

export interface BacklogStory {
  title: string;
  description?: string;
  children?: BacklogStory[];
}

const issueNumber = (identifier: string): number => Number(identifier.split('-')[1]);

export const storyLine = (story: Story): string =>
  `${story.identifier} [${story.labels.join(',')}] ${story.title}`;

// The read half of the workshop scripts as policy: pages of a hundred, the cursor from one
// page becoming the after of the next, merged and sorted by issue number. Every page count
// is narrated — reading page one and declaring victory is the classic mistake.
export const storiesFetch = async ({
  team,
  column,
  linear,
  narrate,
}: {
  team: string;
  column: string;
  linear: LinearWrapper;
  narrate: (line: string) => void;
}): Promise<{ stories: Story[] }> => {
  const stories: Story[] = [];
  let after: string | undefined;
  for (let page = 1; ; page += 1) {
    const result = await linear.storiesPage({ team, column, after });
    narrate(`page ${page}: ${result.stories.length} stories`);
    stories.push(...result.stories);
    if (result.nextCursor === undefined) {
      break;
    }
    after = result.nextCursor;
  }
  stories.sort((a, b) => issueNumber(a.identifier) - issueNumber(b.identifier));
  return { stories };
};

// The mutation half: batches of aliased issueArchive calls, re-fetching the first page of
// the column until it comes back empty — archived stories drop out of default results, so
// convergence is the loop condition and a re-run after a partial failure is safe. The one
// human decision stays human: nothing is archived without the confirm answering yes.
export const storiesArchive = async ({
  team,
  column,
  linear,
  confirm,
  narrate,
  batchSize = 25,
}: {
  team: string;
  column: string;
  linear: LinearWrapper;
  confirm: (question: string) => Promise<boolean>;
  narrate: (line: string) => void;
  batchSize?: number;
}): Promise<ArchiveResult> => {
  let refs = await linear.storyIds({ team, column });
  if (refs.length === 0) {
    narrate(`nothing to archive in ${team}/${column}`);
    return { archived: 0 };
  }
  // A full first page hides the true count behind the cursor, so the question says so.
  const count = refs.length === 100 ? '100 or more' : String(refs.length);
  if (!(await confirm(`archive ${count} stories from ${team}/${column}?`))) {
    return { stopped: 'archive not approved' };
  }
  let archived = 0;
  while (refs.length > 0) {
    for (let start = 0; start < refs.length; start += batchSize) {
      const chunk = refs.slice(start, start + batchSize);
      const successes = await linear.archive(chunk.map((ref) => ref.id));
      if (successes !== chunk.length) {
        return { stopped: `archive fell short: ${successes} of ${chunk.length} in one request` };
      }
      archived += successes;
      narrate(`archived ${archived} so far`);
    }
    refs = await linear.storyIds({ team, column });
  }
  narrate(`${archived} stories archived from ${team}/${column}`);
  return { archived };
};

const countStories = (backlog: BacklogStory[]): number =>
  backlog.reduce((sum, story) => sum + 1 + countStories(story.children ?? []), 0);

const hasUntitled = (backlog: BacklogStory[]): boolean =>
  backlog.some(
    (story) =>
      typeof story.title !== 'string' ||
      story.title.trim() === '' ||
      hasUntitled(story.children ?? []),
  );

// A new project's backlog as a file: stories nest to any depth, and each one is created
// before its children so the children can carry its id as parentId. --dry-run narrates the
// would-have tree and never touches the board; the real run confirms with the full count.
export const storiesCreate = async ({
  team,
  backlog,
  linear,
  confirm,
  narrate,
  dryRun = false,
}: {
  team: string;
  backlog: BacklogStory[];
  linear: LinearWrapper;
  confirm: (question: string) => Promise<boolean>;
  narrate: (line: string) => void;
  dryRun?: boolean;
}): Promise<CreateResult> => {
  const count = countStories(backlog);
  if (count === 0) {
    return { stopped: 'the backlog carries no stories' };
  }
  if (hasUntitled(backlog)) {
    return { stopped: 'a backlog story has no title' };
  }
  if (dryRun) {
    const preview = (stories: BacklogStory[], depth: number): void => {
      for (const story of stories) {
        narrate(`${'  '.repeat(depth)}would have created ${story.title}`);
        preview(story.children ?? [], depth + 1);
      }
    };
    preview(backlog, 0);
    narrate(`would have created ${count} stories in ${team}`);
    return { created: 0 };
  }
  const teamId = await linear.teamId(team);
  if (teamId === undefined) {
    return { stopped: `no team with key ${team}` };
  }
  if (!(await confirm(`create ${count} stories in ${team}?`))) {
    return { stopped: 'create not approved' };
  }
  let created = 0;
  const create = async (
    stories: BacklogStory[],
    parentId: string | undefined,
    depth: number,
  ): Promise<void> => {
    for (const story of stories) {
      const card = await linear.createStory({
        teamId,
        title: story.title,
        ...(story.description === undefined ? {} : { description: story.description }),
        ...(parentId === undefined ? {} : { parentId }),
      });
      created += 1;
      narrate(`${'  '.repeat(depth)}created ${card.identifier} ${story.title}`);
      await create(story.children ?? [], card.id, depth + 1);
    }
  };
  await create(backlog, undefined, 0);
  return { created };
};
