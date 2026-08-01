import { describe, expect, it } from 'vitest';
import { LinearWrapper, type Story } from '../../src/infrastructure/linear.ts';

const story = (identifier: string, overrides: Partial<Story> = {}): Story => ({
  identifier,
  title: `Title for ${identifier}`,
  description: null,
  completedAt: null,
  estimate: null,
  labels: [],
  ...overrides,
});

describe('LinearWrapper', () => {
  it('answers one page with no cursor when that is all there is', async () => {
    const linear = LinearWrapper.createNull({ pages: [[story('DOJ-1')]] });

    const page = await linear.storiesPage({ team: 'DOJ', column: 'Done' });

    expect(page.stories.map((entry) => entry.identifier)).toEqual(['DOJ-1']);
    expect(page.nextCursor).toBeUndefined();
  });

  it('hands back a cursor that fetches the next page', async () => {
    const linear = LinearWrapper.createNull({ pages: [[story('DOJ-1')], [story('DOJ-2')]] });

    const first = await linear.storiesPage({ team: 'DOJ', column: 'Done' });
    expect(first.nextCursor).toBeDefined();

    const second = await linear.storiesPage({
      team: 'DOJ',
      column: 'Done',
      after: first.nextCursor,
    });
    expect(second.stories.map((entry) => entry.identifier)).toEqual(['DOJ-2']);
    expect(second.nextCursor).toBeUndefined();
  });

  it('flattens labels to their names', async () => {
    const linear = LinearWrapper.createNull({
      pages: [[story('DOJ-1', { labels: ['xp', 'dojo'] })]],
    });

    const page = await linear.storiesPage({ team: 'DOJ', column: 'Done' });

    expect(page.stories[0]?.labels).toEqual(['xp', 'dojo']);
  });

  it('answers board pages of identifiers with their columns', async () => {
    const linear = LinearWrapper.createNull({
      board: [
        [
          { identifier: 'DOJ-1', column: 'Done' },
          { identifier: 'DOJ-2', column: 'Backlog' },
        ],
        [{ identifier: 'DOJ-3', column: 'Done' }],
      ],
    });

    const first = await linear.boardPage({ team: 'DOJ' });
    expect(first.rows).toEqual([
      { identifier: 'DOJ-1', column: 'Done' },
      { identifier: 'DOJ-2', column: 'Backlog' },
    ]);
    expect(first.nextCursor).toBeDefined();

    const second = await linear.boardPage({ team: 'DOJ', after: first.nextCursor });
    expect(second.rows).toEqual([{ identifier: 'DOJ-3', column: 'Done' }]);
    expect(second.nextCursor).toBeUndefined();
  });

  it('answers story ids round by round, the last round repeating', async () => {
    const linear = LinearWrapper.createNull({
      idRounds: [[{ id: 'uuid-1', identifier: 'DOJ-1' }], []],
    });

    expect(await linear.storyIds({ team: 'DOJ', column: 'Done' })).toHaveLength(1);
    expect(await linear.storyIds({ team: 'DOJ', column: 'Done' })).toEqual([]);
    expect(await linear.storyIds({ team: 'DOJ', column: 'Done' })).toEqual([]);
  });

  it('archives a batch in one request and records the ids', async () => {
    const linear = LinearWrapper.createNull();
    const archives = linear.trackArchives();

    const successes = await linear.archive(['uuid-1', 'uuid-2']);

    expect(successes).toBe(2);
    expect(archives.data).toEqual([['uuid-1', 'uuid-2']]);
  });

  it('reports fewer successes when a round is configured to fall short', async () => {
    const linear = LinearWrapper.createNull({ archiveRounds: [1] });

    expect(await linear.archive(['uuid-1', 'uuid-2'])).toBe(1);
  });

  it('archives nothing without a request', async () => {
    const linear = LinearWrapper.createNull();
    const archives = linear.trackArchives();

    expect(await linear.archive([])).toBe(0);
    expect(archives.data).toEqual([]);
  });

  it('finds a team with its columns by key and nothing for a stranger', async () => {
    const linear = LinearWrapper.createNull({
      teams: { DOJ: { id: 'team-uuid', columns: ['Backlog', 'Done'] } },
    });

    expect(await linear.team('DOJ')).toEqual({ id: 'team-uuid', columns: ['Backlog', 'Done'] });
    expect(await linear.team('NOPE')).toBeUndefined();
  });

  it('creates stories, minting identifiers, and records the input', async () => {
    const linear = LinearWrapper.createNull();
    const creates = linear.trackCreates();

    const first = await linear.createStory({ teamId: 'team-uuid', title: 'Phase 1' });
    const second = await linear.createStory({
      teamId: 'team-uuid',
      title: 'Story 1',
      parentId: first.id,
    });

    expect(first.identifier).toBe('NULL-1');
    expect(second.identifier).toBe('NULL-2');
    expect(creates.data).toEqual([
      { teamId: 'team-uuid', title: 'Phase 1' },
      { teamId: 'team-uuid', title: 'Story 1', parentId: 'null-issue-1' },
    ]);
  });
});
