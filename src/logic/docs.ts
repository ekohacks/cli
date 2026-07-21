import { ProcessRunner } from '../infrastructure/process.ts';

const OPEN_MARKER = '<!-- ekohacks:entry-points -->';
const CLOSE_MARKER = '<!-- /ekohacks:entry-points -->';

export interface DocsFile {
  path: string;
  content: string;
}

export interface DocsReport {
  checks: { name: string; passed: boolean; reason?: string }[];
}

// The public entry points an exports map declares, as the specifiers a consumer imports:
// "." is the bare package name, "./react" is pkg/react. A package with no exports map —
// or a conditions-only one, with no "." keys — has a single entry point: itself.
export const entryPointsFrom = (pkg: string, exports: unknown): string[] => {
  if (typeof exports !== 'object' || exports === null) {
    return [pkg];
  }
  const subpaths = Object.keys(exports).filter((key) => key.startsWith('.'));
  if (subpaths.length === 0) {
    return [pkg];
  }
  return subpaths
    .filter((key) => key !== './package.json' && !key.includes('*'))
    .map((key) => (key === '.' ? pkg : `${pkg}/${key.slice(2)}`));
};

const blockRegions = (content: string): string[] =>
  content
    .split(OPEN_MARKER)
    .slice(1)
    .map((part) => part.split(CLOSE_MARKER)[0]);

const specifiersIn = (region: string, pkg: string): string[] =>
  [...region.matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)]
    .map(([, fromSpecifier, bareSpecifier]) => fromSpecifier ?? bareSpecifier)
    .filter((specifier) => specifier === pkg || specifier.startsWith(`${pkg}/`));

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

  const entries = entryPointsFrom(pkg, exports);
  for (const file of carriers) {
    const name = `entry points in ${file.path}`;
    const documented = new Set(
      blockRegions(file.content).flatMap((region) => specifiersIn(region, pkg)),
    );
    const notListed = entries.filter((entry) => !documented.has(entry));
    const notExported = [...documented].filter((specifier) => !entries.includes(specifier));
    const reasons = [
      ...(notListed.length > 0 ? [`not listed: ${notListed.join(', ')}`] : []),
      ...(notExported.length > 0 ? [`not in exports: ${notExported.join(', ')}`] : []),
    ];
    checks.push(
      reasons.length > 0
        ? { name, passed: false, reason: reasons.join('; ') }
        : { name, passed: true },
    );
  }

  return { checks };
};
