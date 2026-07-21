import { describe, expect, it } from 'vitest';
import { GhWrapper } from '../../src/infrastructure/gh.ts';
import { GitWrapper } from '../../src/infrastructure/git.ts';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';
import { cut } from '../../src/logic/cut.ts';
import type { PreflightReport } from '../../src/logic/preflight.ts';

const CHANGELOG = ['# Changelog', '', '## 0.5.0', '', '- **A thing.** (#160)', ''].join('\n');

const GREEN_PREFLIGHT: PreflightReport = { checks: [{ name: 'package smoke', passed: true }] };

const runCut = ({
  version = '0.5.0',
  changelog = CHANGELOG,
  report = GREEN_PREFLIGHT,
  git = GitWrapper.createNull(),
  npm = NpmWrapper.createNull(),
  gh = GhWrapper.createNull(),
  narrate = (_line: string) => {},
  confirm = (_question: string) => Promise.resolve(true),
  currentVersion = undefined as string | undefined,
} = {}) =>
  cut({ version, changelog, report, git, npm, gh, narrate, confirm, currentVersion, pollDelayMs: 0 });

describe('cut', () => {
  it('walks the rail in order and merges on green', async () => {
    const git = GitWrapper.createNull();
    const actions = git.trackActions();
    const npm = NpmWrapper.createNull();
    const bumps = npm.trackBumps();
    const gh = GhWrapper.createNull({
      prNumber: 154,
      checkRounds: [
        [{ name: 'build', concluded: false, passed: false }],
        [{ name: 'build', concluded: true, passed: true }],
      ],
    });
    const opens = gh.trackOpens();
    const merges = gh.trackMerges();
    const lines: string[] = [];

    const result = await runCut({ git, npm, gh, narrate: (line) => lines.push(line) });

    expect(result).toEqual({ merged: 154 });
    expect(actions.data).toEqual([
      { action: 'createBranch', branch: 'release/v0.5.0' },
      { action: 'commitAll', message: 'chore: release 0.5.0' },
      { action: 'push' },
    ]);
    expect(bumps.data).toEqual(['0.5.0']);
    expect(opens.data).toEqual([{ title: 'chore: release 0.5.0', body: '- **A thing.** (#160)' }]);
    expect(merges.data).toEqual([154]);
    expect(lines).toEqual([
      'branched release/v0.5.0',
      'bumped to 0.5.0',
      'committed chore: release 0.5.0',
      'pushed',
      'opened pr #154',
      'waiting for checks',
      'merged pr #154',
    ]);
  });

  it('refuses to start when preflight is red', async () => {
    const git = GitWrapper.createNull();
    const actions = git.trackActions();

    const result = await runCut({
      report: {
        checks: [
          { name: 'on main', passed: false, reason: 'on feature/thing, not main' },
          { name: 'clean working tree', passed: true },
        ],
      },
      git,
    });

    expect(result).toEqual({ stopped: 'preflight failed: on main' });
    expect(actions.data).toEqual([]);
  });

  it('stops when the version is already bumped', async () => {
    const git = GitWrapper.createNull();
    const actions = git.trackActions();

    const result = await runCut({ git, currentVersion: '0.5.0' });

    expect(result).toEqual({
      stopped:
        'package.json is already at 0.5.0: the cut looks finished, run ekohacks release ship 0.5.0',
    });
    expect(actions.data).toEqual([]);
  });

  it('stops when the release branch already exists', async () => {
    const git = GitWrapper.createNull({ existingBranches: ['release/v0.5.0'] });
    const actions = git.trackActions();

    const result = await runCut({ git });

    expect(result).toEqual({
      stopped: 'branch release/v0.5.0 already exists from an earlier cut',
    });
    expect(actions.data).toEqual([]);
  });

  it('waits while no checks are reported yet', async () => {
    const gh = GhWrapper.createNull({
      prNumber: 154,
      checkRounds: [[], [{ name: 'build', concluded: true, passed: true }]],
    });
    const merges = gh.trackMerges();
    const lines: string[] = [];

    const result = await runCut({ gh, narrate: (line) => lines.push(line) });

    expect(result).toEqual({ merged: 154 });
    expect(merges.data).toEqual([154]);
    expect(lines.filter((line) => line === 'waiting for checks')).toHaveLength(1);
  });

  it('asks before merging and stops on no', async () => {
    const gh = GhWrapper.createNull({
      prNumber: 154,
      checkRounds: [[{ name: 'build', concluded: true, passed: true }]],
    });
    const merges = gh.trackMerges();
    const questions: string[] = [];

    const result = await runCut({
      gh,
      confirm: (question) => {
        questions.push(question);
        return Promise.resolve(false);
      },
    });

    expect(result).toEqual({ stopped: 'merge not approved' });
    expect(questions).toEqual(['merge pr #154?']);
    expect(merges.data).toEqual([]);
  });

  it('stops with the failing check named when ci is red', async () => {
    const gh = GhWrapper.createNull({
      checkRounds: [
        [
          { name: 'build', concluded: true, passed: true },
          { name: 'test', concluded: true, passed: false },
        ],
      ],
    });
    const merges = gh.trackMerges();

    const result = await runCut({ gh });

    expect(result).toEqual({ stopped: 'check test failed' });
    expect(merges.data).toEqual([]);
  });
});
