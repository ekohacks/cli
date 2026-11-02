import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GitWrapper } from '../../src/infrastructure/git.ts';
import { gitContract, type RepoState } from './gitContract.ts';

const dirs: string[] = [];

// A throwaway repository with a bare origin, in the state the contract asks for: a tracked
// file so that `commit --all` has something to stage, an edit to it when dirty, a local
// commit origin lacks when behind, the manifest origin carries when a version is given.
const throwawayRepo = ({
  branch = 'main',
  dirty = false,
  behindOrigin = false,
  existingBranches = [],
  versionOnMain,
}: RepoState) => {
  const dir = mkdtempSync(join(tmpdir(), 'ekohacks-git-'));
  const bare = mkdtempSync(join(tmpdir(), 'ekohacks-origin-'));
  dirs.push(dir, bare);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir });
  git('init', '-b', 'main');
  git('config', 'user.email', 'test@ekohacks.example');
  git('config', 'user.name', 'test');
  writeFileSync(join(dir, 'version.txt'), '0.4.0\n');
  if (versionOnMain !== undefined) {
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ version: versionOnMain })}\n`);
  }
  git('add', '.');
  git('commit', '-m', 'init');
  execFileSync('git', ['init', '--bare', bare]);
  git('remote', 'add', 'origin', bare);
  git('push', '-u', 'origin', 'main');
  for (const existing of existingBranches) {
    git('branch', existing);
  }
  if (behindOrigin) {
    git('commit', '--allow-empty', '-m', 'not pushed');
  }
  if (branch !== 'main') {
    git('switch', '-c', branch);
  }
  if (versionOnMain !== undefined) {
    // The checkout moves on; origin/main is what the wrapper must answer.
    writeFileSync(join(dir, 'package.json'), '{ "version": "9.9.9" }\n');
    git('commit', '-am', 'bump that never reaches origin');
  }
  if (dirty) {
    writeFileSync(join(dir, 'version.txt'), '0.5.0\n');
  }
  return { dir, bare };
};

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('GitWrapper (integration)', () => {
  gitContract((state) => Promise.resolve(GitWrapper.create({ cwd: throwawayRepo(state).dir })));

  it('refuses to commit a clean tree, as git does', async () => {
    const { dir } = throwawayRepo({});
    const git = GitWrapper.create({ cwd: dir });
    const actions = git.trackActions();

    await expect(git.commitAll('chore: nothing')).rejects.toThrow(/git commit/);

    expect(actions.data).toEqual([]);
  });

  it('lands a pushed branch on the real origin', async () => {
    const { dir, bare } = throwawayRepo({ dirty: true });
    const git = GitWrapper.create({ cwd: dir });

    await git.createBranch('release/v0.5.0');
    await git.commitAll('chore: release 0.5.0');
    await git.push();

    const pushed = execFileSync('git', ['log', '--format=%s', 'release/v0.5.0'], {
      cwd: bare,
    }).toString();
    expect(pushed).toContain('chore: release 0.5.0');
  });
});
