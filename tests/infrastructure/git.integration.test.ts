import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GitWrapper } from '../../src/infrastructure/git.ts';

const repos: string[] = [];

const throwawayRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ekohacks-git-'));
  repos.push(dir);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir });
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@ekohacks.example');
  git('config', 'user.name', 'test');
  git('commit', '--allow-empty', '-m', 'init');
  return dir;
};

afterEach(() => {
  for (const dir of repos.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('GitWrapper (integration)', () => {
  it('answers the current branch of a real repository', async () => {
    const dir = throwawayRepo();

    const git = GitWrapper.create({ cwd: dir });

    expect(await git.currentBranch()).toBe('main');
  });

  it('answers the working tree state of a real repository', async () => {
    const dir = throwawayRepo();
    const git = GitWrapper.create({ cwd: dir });

    expect(await git.workingTreeClean()).toBe(true);

    writeFileSync(join(dir, 'uncommitted.txt'), 'not yet\n');
    expect(await git.workingTreeClean()).toBe(false);
  });
});
