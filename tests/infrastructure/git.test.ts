import { describe, expect, it } from 'vitest';
import { GitWrapper } from '../../src/infrastructure/git.ts';

describe('GitWrapper (nulled)', () => {
  it('answers the configured current branch', async () => {
    const git = GitWrapper.createNull({ branch: 'release/v0.5.0' });

    expect(await git.currentBranch()).toBe('release/v0.5.0');
  });

  it('answers the configured working tree state', async () => {
    const git = GitWrapper.createNull({ dirty: true });

    expect(await git.workingTreeClean()).toBe(false);
  });

  it('answers the configured origin sync state', async () => {
    const git = GitWrapper.createNull({ behindOrigin: true });

    expect(await git.mainInSyncWithOrigin()).toBe(false);
  });

  it('records branch, commit and push on its output tracker', async () => {
    const git = GitWrapper.createNull();
    const actions = git.trackActions();

    await git.createBranch('release/v0.5.0');
    await git.commitAll('chore: release 0.5.0');
    await git.push();

    expect(actions.data).toEqual([
      { action: 'createBranch', branch: 'release/v0.5.0' },
      { action: 'commitAll', message: 'chore: release 0.5.0' },
      { action: 'push' },
    ]);
  });
});
