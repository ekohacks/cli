import { setTimeout as delay } from 'node:timers/promises';
import { changelogEntryFor } from './changelog.ts';
import { GhWrapper } from '../infrastructure/gh.ts';
import { NpmWrapper } from '../infrastructure/npm.ts';

export type ShipResult = { shipped: string } | { stopped: string };

// The tail of RELEASING.md as a policy: cut the GitHub Release, approve the publish
// gate, follow the run to green, and only report success once the registry serves the
// version. The one human decision stays human: the gate is never approved without the
// confirm answering yes.
export const ship = async ({
  version,
  changelog,
  pkg,
  gh,
  npm,
  confirm,
  narrate,
  pollDelayMs = 15_000,
  registryAttempts = 20,
  workflow = 'publish.yml',
}: {
  version: string;
  changelog: string;
  pkg: string;
  gh: GhWrapper;
  npm: NpmWrapper;
  confirm: (question: string) => Promise<boolean>;
  narrate: (line: string) => void;
  pollDelayMs?: number;
  registryAttempts?: number;
  workflow?: string;
}): Promise<ShipResult> => {
  const tag = `v${version}`;
  const notes = changelogEntryFor(changelog, version) ?? '';
  await gh.createRelease({ tag, title: tag, notes });
  narrate(`release ${tag} cut`);

  const waiting = await gh.waitingRun(workflow);
  if (waiting === undefined) {
    return { stopped: 'no waiting publish run' };
  }

  if (!(await confirm(`approve the release gate for run #${waiting.id}?`))) {
    return { stopped: 'gate not approved' };
  }
  await gh.approveRun(waiting.id);
  narrate(`gate approved for run #${waiting.id}`);

  let state = await gh.run(waiting.id);
  while (!state.concluded) {
    narrate('waiting for the publish run');
    await delay(pollDelayMs);
    state = await gh.run(waiting.id);
  }
  if (!state.passed) {
    return { stopped: `publish run failed: ${state.url}` };
  }
  narrate('publish run green');

  for (let attempt = 0; attempt < registryAttempts; attempt += 1) {
    if ((await npm.publishedVersion(pkg)) === version) {
      narrate(`registry serves ${pkg}@${version}`);
      return { shipped: version };
    }
    narrate('waiting for the registry');
    await delay(pollDelayMs);
  }
  return { stopped: `registry never served ${pkg}@${version}` };
};
