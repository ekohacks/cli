import { expect, it } from 'vitest';
import type { GitWrapper } from '../../src/infrastructure/git.ts';

// The behaviour every GitWrapper must honour, real or null (observatory ADR 0023, rule
// three). `make` builds a wrapper over a repository in the given state: the real side makes
// a throwaway repository with a bare origin and puts it in that state; the null is handed
// the state and must answer as that repository would, including after its own writes.
export interface RepoState {
  branch?: string;
  dirty?: boolean;
  behindOrigin?: boolean;
  existingBranches?: string[];
  versionOnMain?: string;
}
export type MakeGit = (state: RepoState) => Promise<GitWrapper>;

export function gitContract(make: MakeGit): void {
  it('answers the current branch', async () => {
    const git = await make({ branch: 'release/v0.5.0' });

    expect(await git.currentBranch()).toBe('release/v0.5.0');
  });

  it('answers a clean working tree as clean and an edited one as not', async () => {
    expect(await (await make({})).workingTreeClean()).toBe(true);
    expect(await (await make({ dirty: true })).workingTreeClean()).toBe(false);
  });

  it('answers whether main is in sync with origin', async () => {
    expect(await (await make({})).mainInSyncWithOrigin()).toBe(true);
    expect(await (await make({ behindOrigin: true })).mainInSyncWithOrigin()).toBe(false);
  });

  it('answers the version main carries on origin', async () => {
    const git = await make({ versionOnMain: '0.4.1' });

    expect(await git.versionOnMain()).toBe('0.4.1');
  });

  it('answers whether a branch exists', async () => {
    const git = await make({ existingBranches: ['release/v0.5.0'] });

    expect(await git.branchExists('release/v0.5.0')).toBe(true);
    expect(await git.branchExists('release/v9.9.9')).toBe(false);
  });

  it('creates a branch, which is then the current one and exists, and records it', async () => {
    const git = await make({});
    const actions = git.trackActions();

    await git.createBranch('release/v0.5.0');

    expect(await git.currentBranch()).toBe('release/v0.5.0');
    expect(await git.branchExists('release/v0.5.0')).toBe(true);
    expect(actions.data).toEqual([{ action: 'createBranch', branch: 'release/v0.5.0' }]);
  });

  it('commits everything on an edited tree, which is then clean, and records it', async () => {
    const git = await make({ dirty: true });
    const actions = git.trackActions();

    await git.commitAll('chore: release 0.5.0');

    expect(await git.workingTreeClean()).toBe(true);
    expect(actions.data).toEqual([{ action: 'commitAll', message: 'chore: release 0.5.0' }]);
  });

  it('refuses to commit a clean tree and records nothing', async () => {
    const git = await make({});
    const actions = git.trackActions();

    await expect(git.commitAll('chore: nothing')).rejects.toThrow(/nothing to commit/);

    expect(actions.data).toEqual([]);
  });

  it('pushes the current branch to origin and records it', async () => {
    const git = await make({});
    const actions = git.trackActions();

    await git.createBranch('release/v0.5.0');
    await git.push();

    expect(actions.data).toEqual([
      { action: 'createBranch', branch: 'release/v0.5.0' },
      { action: 'push' },
    ]);
  });
}
