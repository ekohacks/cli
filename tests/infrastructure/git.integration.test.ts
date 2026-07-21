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

  it('answers the origin sync state of a real repository', async () => {
    const dir = throwawayRepo();
    const run = (...args: string[]) => execFileSync('git', args, { cwd: dir });
    const bare = mkdtempSync(join(tmpdir(), 'ekohacks-origin-'));
    repos.push(bare);
    execFileSync('git', ['init', '--bare', bare]);
    run('remote', 'add', 'origin', bare);
    run('push', '-u', 'origin', 'main');

    const git = GitWrapper.create({ cwd: dir });
    expect(await git.mainInSyncWithOrigin()).toBe(true);

    run('commit', '--allow-empty', '-m', 'not pushed');
    expect(await git.mainInSyncWithOrigin()).toBe(false);
  });

  it('answers the version main carries on origin, not in the checkout', async () => {
    const dir = throwawayRepo();
    const run = (...args: string[]) => execFileSync('git', args, { cwd: dir });
    writeFileSync(join(dir, 'package.json'), '{ "version": "0.4.1" }\n');
    run('add', 'package.json');
    run('commit', '-m', 'track a manifest');

    const bare = mkdtempSync(join(tmpdir(), 'ekohacks-origin-'));
    repos.push(bare);
    execFileSync('git', ['init', '--bare', bare]);
    run('remote', 'add', 'origin', bare);
    run('push', '-u', 'origin', 'main');

    const git = GitWrapper.create({ cwd: dir });
    expect(await git.versionOnMain()).toBe('0.4.1');

    writeFileSync(join(dir, 'package.json'), '{ "version": "0.5.0" }\n');
    run('commit', '-am', 'bump that never reaches origin');
    expect(await git.versionOnMain()).toBe('0.4.1');
  });

  it('branches, commits and pushes to a real origin', async () => {
    const dir = throwawayRepo();
    const run = (...args: string[]) => execFileSync('git', args, { cwd: dir });
    writeFileSync(join(dir, 'version.txt'), '0.4.0\n');
    run('add', 'version.txt');
    run('commit', '-m', 'track a file');

    const bare = mkdtempSync(join(tmpdir(), 'ekohacks-origin-'));
    repos.push(bare);
    execFileSync('git', ['init', '--bare', bare]);
    run('remote', 'add', 'origin', bare);

    const git = GitWrapper.create({ cwd: dir });
    await git.createBranch('release/v0.5.0');
    writeFileSync(join(dir, 'version.txt'), '0.5.0\n');
    await git.commitAll('chore: release 0.5.0');
    await git.push();

    expect(await git.currentBranch()).toBe('release/v0.5.0');
    const pushed = execFileSync('git', ['log', '--format=%s', 'release/v0.5.0'], {
      cwd: bare,
    }).toString();
    expect(pushed).toContain('chore: release 0.5.0');
  });
});
