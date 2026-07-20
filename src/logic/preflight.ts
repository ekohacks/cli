import { changelogEntryFor } from './changelog.ts';

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
export const preflight = ({
  version,
  changelog,
}: {
  version: string;
  changelog: string;
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

  return Promise.resolve({ checks: [changelogCheck] });
};
