import { setTimeout as delay } from 'node:timers/promises';
import { changelogEntryFor } from './changelog.ts';
import type { PreflightReport } from './preflight.ts';
import { GhWrapper } from '../infrastructure/gh.ts';
import { GitWrapper } from '../infrastructure/git.ts';
import { NpmWrapper } from '../infrastructure/npm.ts';

export type CutResult = { merged: number } | { stopped: string };

// The mechanical middle of RELEASING.md as a policy: branch, bump, commit, push, open the
// release PR, wait for CI, merge on green. It refuses to start unless preflight passed,
// and every stop names the reason so a human can pick up by hand. The caller supplies the
// wrappers and hears each step through narrate.
export const cut = async ({
  version,
  changelog,
  report,
  git,
  npm,
  gh,
  narrate,
  pollDelayMs = 15_000,
}: {
  version: string;
  changelog: string;
  report: PreflightReport;
  git: GitWrapper;
  npm: NpmWrapper;
  gh: GhWrapper;
  narrate: (line: string) => void;
  pollDelayMs?: number;
}): Promise<CutResult> => {
  const failed = report.checks.filter((check) => !check.passed);
  if (failed.length > 0) {
    return { stopped: `preflight failed: ${failed.map((check) => check.name).join(', ')}` };
  }

  const branch = `release/v${version}`;
  await git.createBranch(branch);
  narrate(`branched ${branch}`);

  await npm.bumpVersion(version);
  narrate(`bumped to ${version}`);

  const message = `chore: release ${version}`;
  await git.commitAll(message);
  narrate(`committed ${message}`);

  await git.push();
  narrate('pushed');

  const body = changelogEntryFor(changelog, version) ?? '';
  const { number } = await gh.openPr({ title: message, body });
  narrate(`opened pr #${number}`);

  let checks = await gh.checks(number);
  while (!checks.every((check) => check.concluded)) {
    narrate('waiting for checks');
    await delay(pollDelayMs);
    checks = await gh.checks(number);
  }

  const failing = checks.find((check) => !check.passed);
  if (failing !== undefined) {
    return { stopped: `check ${failing.name} failed` };
  }

  await gh.mergePr(number);
  narrate(`merged pr #${number}`);
  return { merged: number };
};
