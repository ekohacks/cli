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
} = {}) => cut({ version, changelog, report, git, npm, gh, narrate, pollDelayMs: 0 });

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
    expect(opens.data).toEqual([
      { title: 'chore: release 0.5.0', body: '- **A thing.** (#160)' },
    ]);
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
});
