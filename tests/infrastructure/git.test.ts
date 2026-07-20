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
});
