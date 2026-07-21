import { cut } from './cut.ts';
import { preflight } from './preflight.ts';
import { ship } from './ship.ts';
import { GhWrapper } from '../infrastructure/gh.ts';
import { GitWrapper } from '../infrastructure/git.ts';
import { NpmWrapper } from '../infrastructure/npm.ts';
import { ProcessRunner } from '../infrastructure/process.ts';

export type ReleaseResult = { shipped: string } | { stopped: string };

// The whole of RELEASING.md as one command: preflight, cut, ship in order, stopping at
// the first failure with that stage's own reason. No stage's logic lives here — this
// policy only composes the three and decides which pauses --yes may skip: the merge and
// the Release. The gate always asks.
export const release = async ({
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
  yes = false,
  pollDelayMs,
  findRunAttempts,
  registryAttempts,
}: {
  version: string;
  changelog: string;
  lockfile: string;
  pkg: string;
  git: GitWrapper;
  npm: NpmWrapper;
  gh: GhWrapper;
  runner: ProcessRunner;
  confirm: (question: string) => Promise<boolean>;
  narrate: (line: string) => void;
  yes?: boolean;
  pollDelayMs?: number;
  findRunAttempts?: number;
  registryAttempts?: number;
}): Promise<ReleaseResult> => {
  const report = await preflight({ version, changelog, npm, pkg, git, lockfile, runner });
  for (const check of report.checks) {
    narrate(check.passed ? `ok ${check.name}` : `FAIL ${check.name}: ${check.reason}`);
  }

  const skippable = yes ? () => Promise.resolve(true) : confirm;

  const cutResult = await cut({
    version,
    changelog,
    report,
    git,
    npm,
    gh,
    narrate,
    confirm: skippable,
    pollDelayMs,
  });
  if ('stopped' in cutResult) {
    return cutResult;
  }

  return ship({
    version,
    changelog,
    pkg,
    gh,
    npm,
    confirm,
    confirmRelease: skippable,
    narrate,
    pollDelayMs,
    findRunAttempts,
    registryAttempts,
  });
};
