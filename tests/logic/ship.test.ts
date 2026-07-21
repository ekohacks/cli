import { describe, expect, it } from 'vitest';
import { GhWrapper } from '../../src/infrastructure/gh.ts';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';
import { ship } from '../../src/logic/ship.ts';

const CHANGELOG = ['# Changelog', '', '## 0.5.0', '', '- **A thing.** (#160)', ''].join('\n');

const runShip = ({
  version = '0.5.0',
  changelog = CHANGELOG,
  pkg = 'ekolite',
  gh = GhWrapper.createNull({ waitingRun: 123 }),
  npm = NpmWrapper.createNull({ publishedVersions: { ekolite: '0.5.0' } }),
  confirm = (_question: string) => Promise.resolve(true),
  narrate = (_line: string) => {},
} = {}) =>
  ship({
    version,
    changelog,
    pkg,
    gh,
    npm,
    confirm,
    narrate,
    pollDelayMs: 0,
    registryAttempts: 2,
  });

describe('ship', () => {
  it('cuts the release, approves the gate and reports the registry', async () => {
    const url = 'https://github.com/nulled/nulled/actions/runs/123';
    const gh = GhWrapper.createNull({
      waitingRun: 123,
      runRounds: [
        { concluded: false, passed: false, url },
        { concluded: true, passed: true, url },
      ],
    });
    const releases = gh.trackReleases();
    const approvals = gh.trackApprovals();
    const lines: string[] = [];

    const result = await runShip({ gh, narrate: (line) => lines.push(line) });

    expect(result).toEqual({ shipped: '0.5.0' });
    expect(releases.data).toEqual([
      { tag: 'v0.5.0', title: 'v0.5.0', notes: '- **A thing.** (#160)' },
    ]);
    expect(approvals.data).toEqual([123]);
    expect(lines).toEqual([
      'release v0.5.0 cut',
      'gate approved for run #123',
      'waiting for the publish run',
      'publish run green',
      'registry serves ekolite@0.5.0',
    ]);
  });
});
