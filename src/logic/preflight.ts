import { changelogEntryFor } from './changelog.ts';
import { GitWrapper } from '../infrastructure/git.ts';
import { NpmWrapper } from '../infrastructure/npm.ts';

export interface PreflightCheck {
  name: string;
  passed: boolean;
  reason?: string;
}

export interface PreflightReport {
  checks: PreflightCheck[];
}

// The "Before cutting" checklist from RELEASING.md as a policy: each check answers with
// its name and, when it fails, the reason a human needs to fix it. The caller supplies
// file contents and wrappers; the policy only judges.
export const preflight = async ({
  version,
  changelog,
  npm,
  pkg,
  git,
  lockfile,
}: {
  version: string;
  changelog: string;
  npm: NpmWrapper;
  pkg: string;
  git: GitWrapper;
  lockfile: string;
}): Promise<PreflightReport> => {
  const entry = changelogEntryFor(changelog, version);
  const changelogCheck: PreflightCheck =
    entry === undefined
      ? {
          name: 'changelog entry',
          passed: false,
          reason: `no ## ${version} heading in the changelog`,
        }
      : { name: 'changelog entry', passed: true };

  const published = await npm.publishedVersion(pkg);
  const versionCheck: PreflightCheck =
    published === version
      ? { name: 'version is new', passed: false, reason: `${version} is already published` }
      : { name: 'version is new', passed: true };

  const branch = await git.currentBranch();
  const branchCheck: PreflightCheck =
    branch === 'main'
      ? { name: 'on main', passed: true }
      : { name: 'on main', passed: false, reason: `on ${branch}, not main` };

  const treeClean = await git.workingTreeClean();
  const treeCheck: PreflightCheck = treeClean
    ? { name: 'clean working tree', passed: true }
    : {
        name: 'clean working tree',
        passed: false,
        reason: 'uncommitted changes in the working tree',
      };

  const lockfileCheck: PreflightCheck = lockfile.includes('npmmirror')
    ? {
        name: 'lockfile registry',
        passed: false,
        reason: 'lockfile resolves packages outside registry.npmjs.org',
      }
    : { name: 'lockfile registry', passed: true };

  return { checks: [changelogCheck, versionCheck, branchCheck, treeCheck, lockfileCheck] };
};
