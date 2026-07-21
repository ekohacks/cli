import { ProcessRunner } from '../infrastructure/process.ts';

const OPEN_MARKER = '<!-- ekohacks:entry-points -->';

export interface DocsFile {
  path: string;
  content: string;
}

export interface DocsReport {
  checks: { name: string; passed: boolean; reason?: string }[];
}

// The drift detector as a policy: the exports map is the truth, the docs carry their
// claims in a block the tool owns, and every mismatch is a named check with the reason
// a human needs to fix it. The caller supplies file contents and the runner; the policy
// only judges.
export const docsCheck = async ({
  pkg,
  exports,
  files,
  runner,
}: {
  pkg: string;
  exports: unknown;
  files: DocsFile[];
  runner: ProcessRunner;
}): Promise<DocsReport> => {
  const checks: DocsReport['checks'] = [];

  const carriers = files.filter((file) => file.content.includes(OPEN_MARKER));
  checks.push(
    carriers.length > 0
      ? { name: 'entry points declared', passed: true }
      : {
          name: 'entry points declared',
          passed: false,
          reason: `no docs file carries an ${OPEN_MARKER} block`,
        },
  );

  return { checks };
};
