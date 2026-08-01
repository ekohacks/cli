import { describe, expect, it } from 'vitest';
import { LinearWrapper, type Story, type StoryRef } from '../../src/infrastructure/linear.ts';
import {
  storiesArchive,
  storiesCreate,
  storiesFetch,
  storyLine,
  type BacklogStory,
} from '../../src/logic/stories.ts';

const story = (identifier: string, overrides: Partial<Story> = {}): Story => ({
  identifier,
  title: `Title for ${identifier}`,
  description: null,
  completedAt: null,
  estimate: null,
  labels: [],
  ...overrides,
});

const refs = (count: number, offset = 0): StoryRef[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `uuid-${index + offset}`,
    identifier: `DOJ-${index + offset}`,
  }));

describe('storyLine', () => {
  it('prints identifier, labels and title on one line', () => {
    const line = storyLine(story('DOJ-77', { labels: ['xp', 'dojo'], title: 'A quiet week' }));

    expect(line).toBe('DOJ-77 [xp,dojo] A quiet week');
  });
});

describe('storiesFetch', () => {
  it('merges every page and sorts by issue number', async () => {
    const linear = LinearWrapper.createNull({
      teams: { DOJ: { id: 'team-uuid', columns: ['Done'] } },
      pages: [[story('DOJ-10'), story('DOJ-2')], [story('DOJ-1')]],
    });
    const lines: string[] = [];

    const result = await storiesFetch({
      team: 'DOJ',
      column: 'Done',
      linear,
      narrate: (line) => lines.push(line),
    });

    expect(result).toEqual({ stories: [story('DOJ-1'), story('DOJ-2'), story('DOJ-10')] });
    expect(lines).toEqual(['page 1: 2 stories', 'page 2: 1 stories']);
  });

  it('stops when the team is unknown, before any page', async () => {
    const linear = LinearWrapper.createNull({ pages: [[story('DOJ-1')]] });
    const lines: string[] = [];

    const result = await storiesFetch({
      team: 'DOJ',
      column: 'Done',
      linear,
      narrate: (line) => lines.push(line),
    });

    expect(result).toEqual({ stopped: 'no team with key DOJ' });
    expect(lines).toEqual([]);
  });

  it('stops on an unknown column, naming the real ones', async () => {
    const linear = LinearWrapper.createNull({
      teams: { DOJ: { id: 'team-uuid', columns: ['Backlog', 'In Progress', 'Done'] } },
    });

    const result = await storiesFetch({
      team: 'DOJ',
      column: 'InProgress',
      linear,
      narrate: () => {},
    });

    expect(result).toEqual({
      stopped: 'no column "InProgress" in DOJ (it has: Backlog, In Progress, Done)',
    });
  });
});

describe('storiesArchive', () => {
  const doneBoard = { teams: { DOJ: { id: 'team-uuid', columns: ['Done'] } } };

  const runArchive = ({
    linear = LinearWrapper.createNull(doneBoard),
    column = 'Done',
    confirm = (_question: string) => Promise.resolve(true),
    narrate = (_line: string) => {},
    batchSize = 25,
  } = {}) => storiesArchive({ team: 'DOJ', column, linear, confirm, narrate, batchSize });

  it('archives page after page until the column comes back empty', async () => {
    const linear = LinearWrapper.createNull({ ...doneBoard, idRounds: [refs(3), refs(2, 3), []] });
    const archives = linear.trackArchives();
    const lines: string[] = [];

    const result = await runArchive({ linear, batchSize: 2, narrate: (line) => lines.push(line) });

    expect(result).toEqual({ archived: 5 });
    expect(archives.data).toEqual([['uuid-0', 'uuid-1'], ['uuid-2'], ['uuid-3', 'uuid-4']]);
    expect(lines).toContain('5 stories archived from DOJ/Done');
  });

  it('asks first, naming the count, and stops on no', async () => {
    const linear = LinearWrapper.createNull({ ...doneBoard, idRounds: [refs(3)] });
    const archives = linear.trackArchives();
    const questions: string[] = [];

    const result = await runArchive({
      linear,
      confirm: (question) => {
        questions.push(question);
        return Promise.resolve(false);
      },
    });

    expect(result).toEqual({ stopped: 'archive not approved' });
    expect(questions).toEqual(['archive 3 stories from DOJ/Done?']);
    expect(archives.data).toEqual([]);
  });

  it('calls a full first page 100 or more', async () => {
    const linear = LinearWrapper.createNull({ ...doneBoard, idRounds: [refs(100), []] });
    const questions: string[] = [];

    await runArchive({
      linear,
      confirm: (question) => {
        questions.push(question);
        return Promise.resolve(true);
      },
    });

    expect(questions).toEqual(['archive 100 or more stories from DOJ/Done?']);
  });

  it('reports an empty column without asking', async () => {
    const questions: string[] = [];
    const lines: string[] = [];

    const result = await runArchive({
      confirm: (question) => {
        questions.push(question);
        return Promise.resolve(true);
      },
      narrate: (line) => lines.push(line),
    });

    expect(result).toEqual({ archived: 0 });
    expect(questions).toEqual([]);
    expect(lines).toEqual(['nothing to archive in DOJ/Done']);
  });

  it('stops when a request falls short instead of spinning', async () => {
    const linear = LinearWrapper.createNull({
      ...doneBoard,
      idRounds: [refs(2)],
      archiveRounds: [1],
    });

    const result = await runArchive({ linear });

    expect(result).toEqual({ stopped: 'archive fell short: 1 of 2 in one request' });
  });

  it('stops when the team is unknown, before asking', async () => {
    const linear = LinearWrapper.createNull({ idRounds: [refs(3)] });
    const archives = linear.trackArchives();
    const questions: string[] = [];

    const result = await runArchive({
      linear,
      confirm: (question) => {
        questions.push(question);
        return Promise.resolve(true);
      },
    });

    expect(result).toEqual({ stopped: 'no team with key DOJ' });
    expect(questions).toEqual([]);
    expect(archives.data).toEqual([]);
  });

  it('stops on an unknown column, naming the real ones', async () => {
    const linear = LinearWrapper.createNull({
      teams: { DOJ: { id: 'team-uuid', columns: ['Backlog', 'In Progress', 'Done'] } },
      idRounds: [refs(3)],
    });
    const archives = linear.trackArchives();

    const result = await runArchive({ linear, column: 'InProgress' });

    expect(result).toEqual({
      stopped: 'no column "InProgress" in DOJ (it has: Backlog, In Progress, Done)',
    });
    expect(archives.data).toEqual([]);
  });
});

describe('storiesCreate', () => {
  const backlog: BacklogStory[] = [
    {
      title: 'Phase 1',
      description: 'The foundation',
      children: [{ title: 'Story 1' }, { title: 'Story 2' }],
    },
    { title: 'Phase 2' },
  ];

  const runCreate = ({
    team = 'DOJ',
    stories = backlog,
    linear = LinearWrapper.createNull({ teams: { DOJ: { id: 'team-uuid', columns: [] } } }),
    confirm = (_question: string) => Promise.resolve(true),
    narrate = (_line: string) => {},
    dryRun = false,
  } = {}) => storiesCreate({ team, backlog: stories, linear, confirm, narrate, dryRun });

  it('creates the backlog depth first, children under their parent', async () => {
    const linear = LinearWrapper.createNull({ teams: { DOJ: { id: 'team-uuid', columns: [] } } });
    const creates = linear.trackCreates();
    const lines: string[] = [];

    const result = await runCreate({ linear, narrate: (line) => lines.push(line) });

    expect(result).toEqual({ created: 4 });
    expect(creates.data).toEqual([
      { teamId: 'team-uuid', title: 'Phase 1', description: 'The foundation' },
      { teamId: 'team-uuid', title: 'Story 1', parentId: 'null-issue-1' },
      { teamId: 'team-uuid', title: 'Story 2', parentId: 'null-issue-1' },
      { teamId: 'team-uuid', title: 'Phase 2' },
    ]);
    expect(lines).toEqual([
      'created NULL-1 Phase 1',
      '  created NULL-2 Story 1',
      '  created NULL-3 Story 2',
      'created NULL-4 Phase 2',
    ]);
  });

  it('previews the tree on a dry run and touches nothing', async () => {
    const linear = LinearWrapper.createNull();
    const creates = linear.trackCreates();
    const lines: string[] = [];

    const result = await runCreate({ linear, dryRun: true, narrate: (line) => lines.push(line) });

    expect(result).toEqual({ created: 0 });
    expect(creates.data).toEqual([]);
    expect(lines).toEqual([
      'would have created Phase 1',
      '  would have created Story 1',
      '  would have created Story 2',
      'would have created Phase 2',
      'would have created 4 stories in DOJ',
    ]);
  });

  it('stops when the team is unknown', async () => {
    const linear = LinearWrapper.createNull();

    const result = await runCreate({ linear });

    expect(result).toEqual({ stopped: 'no team with key DOJ' });
  });

  it('asks first, naming the count, and stops on no', async () => {
    const linear = LinearWrapper.createNull({ teams: { DOJ: { id: 'team-uuid', columns: [] } } });
    const creates = linear.trackCreates();
    const questions: string[] = [];

    const result = await runCreate({
      linear,
      confirm: (question) => {
        questions.push(question);
        return Promise.resolve(false);
      },
    });

    expect(result).toEqual({ stopped: 'create not approved' });
    expect(questions).toEqual(['create 4 stories in DOJ?']);
    expect(creates.data).toEqual([]);
  });

  it('stops on a story with no title', async () => {
    const stories = [{ title: 'Phase 1', children: [{} as BacklogStory] }];

    const result = await runCreate({ stories });

    expect(result).toEqual({ stopped: 'a backlog story has no title' });
  });

  it('stops on an empty backlog', async () => {
    const result = await runCreate({ stories: [] });

    expect(result).toEqual({ stopped: 'the backlog carries no stories' });
  });
});
