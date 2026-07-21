import { describe, expect, it } from 'vitest';
import { GhWrapper } from '../../src/infrastructure/gh.ts';
import { GitWrapper } from '../../src/infrastructure/git.ts';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';
import { ProcessRunner } from '../../src/infrastructure/process.ts';
import { release } from '../../src/logic/release.ts';

const CHANGELOG = ['# Changelog', '', '## 0.5.0', '', '- **A thing.** (#160)', ''].join('\n');

const greenGh = () =>
  GhWrapper.createNull({
    prNumber: 154,
    checkRounds: [[{ name: 'build', concluded: true, passed: true }]],
    waitingRunRounds: [123],
  });

const runRelease = ({
  version = '0.5.0',
  changelog = CHANGELOG,
  lockfile = '{}',
  pkg = 'ekolite',
  git = GitWrapper.createNull(),
  npm = NpmWrapper.createNull({ publishedVersions: { ekolite: ['0.4.0', '0.5.0'] } }),
  gh = greenGh(),
  runner = ProcessRunner.createNull(),
  confirm = (_question: string) => Promise.resolve(true),
  narrate = (_line: string) => {},
  yes = false,
} = {}) =>
  release({
    version,
    changelog,
    lockfile,
    pkg,
    git,
    npm,
    gh,
    runner,
    confirm,
    narrate,
    yes,
    pollDelayMs: 0,
    findRunAttempts: 2,
    registryAttempts: 2,
  });

describe('release', () => {
  it('runs preflight, cut and ship as one story', async () => {
    const lines: string[] = [];

    const result = await runRelease({ narrate: (line) => lines.push(line) });

    expect(result).toEqual({ shipped: '0.5.0' });
    expect(lines).toEqual([
      'ok changelog entry',
      'ok version is new',
      'ok on main',
      'ok in sync with origin',
      'ok clean working tree',
      'ok lockfile registry',
      'ok package smoke',
      'branched release/v0.5.0',
      'bumped to 0.5.0',
      'committed chore: release 0.5.0',
      'pushed',
      'opened pr #154',
      'merged pr #154',
      'release v0.5.0 cut',
      'gate approved for run #123',
      'publish run green',
      'registry serves ekolite@0.5.0',
    ]);
  });

  it('stops after preflight with the failing checks named', async () => {
    const git = GitWrapper.createNull({ branch: 'feature/thing' });
    const npm = NpmWrapper.createNull();
    const bumps = npm.trackBumps();
    const lines: string[] = [];

    const result = await runRelease({ git, npm, narrate: (line) => lines.push(line) });

    expect(result).toEqual({ stopped: 'preflight failed: on main' });
    expect(lines).toContain('FAIL on main: on feature/thing, not main');
    expect(bumps.data).toEqual([]);
  });

  it('asks at the merge, the release and the gate', async () => {
    const questions: string[] = [];

    const result = await runRelease({
      confirm: (question) => {
        questions.push(question);
        return Promise.resolve(true);
      },
    });

    expect(result).toEqual({ shipped: '0.5.0' });
    expect(questions).toEqual([
      'merge pr #154?',
      'cut release v0.5.0?',
      'approve the release gate for run #123?',
    ]);
  });

  it('skips the merge and release pauses with --yes, but the gate still asks', async () => {
    const questions: string[] = [];

    const result = await runRelease({
      yes: true,
      confirm: (question) => {
        questions.push(question);
        return Promise.resolve(true);
      },
    });

    expect(result).toEqual({ shipped: '0.5.0' });
    expect(questions).toEqual(['approve the release gate for run #123?']);
  });

  it('an abort at a pause stops the chain there', async () => {
    const gh = greenGh();
    const merges = gh.trackMerges();
    const releases = gh.trackReleases();

    const result = await runRelease({ gh, confirm: () => Promise.resolve(false) });

    expect(result).toEqual({ stopped: 'merge not approved' });
    expect(merges.data).toEqual([]);
    expect(releases.data).toEqual([]);
  });
});
