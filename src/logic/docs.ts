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

const blockRegions = (content: string): { regions: string[]; unclosed: boolean } => {
  const regions: string[] = [];
  let rest = content;
  for (;;) {
    const open = rest.indexOf(OPEN_MARKER);
    if (open === -1) {
      return { regions, unclosed: false };
    }
    const afterOpen = rest.slice(open + OPEN_MARKER.length);
    const close = afterOpen.indexOf(CLOSE_MARKER);
    if (close === -1) {
      return { regions, unclosed: true };
    }
    regions.push(afterOpen.slice(0, close));
    rest = afterOpen.slice(close + CLOSE_MARKER.length);
  }
};

const specifiersIn = (region: string, pkg: string): string[] =>
  [...region.matchAll(/from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)]
    .map(([, fromSpecifier, bareSpecifier]) => fromSpecifier ?? bareSpecifier)
    .filter((specifier) => specifier === pkg || specifier.startsWith(`${pkg}/`));

const COUNT_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const countClaimsIn = (content: string): number[] =>
  [
    ...content.matchAll(
      /\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]+entry[\s-]+points?\b/gi,
    ),
  ].map(([, claim]) => COUNT_WORDS[claim.toLowerCase()] ?? Number(claim));

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
    const { regions, unclosed } = blockRegions(file.content);
    if (unclosed) {
      checks.push({ name, passed: false, reason: 'unclosed ekohacks:entry-points block' });
      continue;
    }
    const documented = new Set(regions.flatMap((region) => specifiersIn(region, pkg)));
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

  for (const file of files) {
    const wrong = countClaimsIn(file.content).filter((claim) => claim !== entries.length);
    if (wrong.length > 0) {
      checks.push({
        name: `entry count in ${file.path}`,
        passed: false,
        reason: `claims ${wrong.join(' and ')} entry points, exports has ${entries.length}`,
      });
    }
  }

  return { checks };
};
