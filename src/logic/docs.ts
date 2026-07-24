import { ProcessRunner } from '../infrastructure/process.ts';

const DOCS_BUILD_COMMAND = 'npm run docs:build';
const OPEN_MARKER = '<!-- ekohacks:entry-points -->';
const CLOSE_MARKER = '<!-- /ekohacks:entry-points -->';

export interface DocsFile {
  path: string;
  content: string;
}

export interface DocsReport {
  checks: { name: string; passed: boolean; reason?: string }[];
}

export interface DocsSyncResult {
  edits: DocsFile[];
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
    .map(([, fromSpecifier, bareSpecifier]) => fromSpecifier ?? bareSpecifier ?? '')
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

// One definition of what a claim looks like, read by the check and rewritten by the sync — two
// copies of it would be their own drift. Built fresh at each use: a shared global regex carries
// its lastIndex from call to call.
const COUNT_CLAIM_SOURCE = String.raw`\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]+entry[\s-]+points?\b`;
const countClaims = () => new RegExp(COUNT_CLAIM_SOURCE, 'gi');

const countClaimsIn = (content: string): number[] =>
  [...content.matchAll(countClaims())].map(
    ([, claim = '']) => COUNT_WORDS[claim.toLowerCase()] ?? Number(claim),
  );

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

  const scanned = files.filter((file) => !file.path.split('/').includes('.vitepress'));
  const carriers = scanned.filter((file) => file.content.includes(OPEN_MARKER));
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

  for (const file of scanned) {
    const claims = countClaimsIn(file.content);
    if (claims.length === 0) {
      continue;
    }
    const name = `entry count in ${file.path}`;
    const wrong = claims.filter((claim) => claim !== entries.length);
    checks.push(
      wrong.length > 0
        ? {
            name,
            passed: false,
            reason: `claims ${wrong.join(' and ')} entry points, exports has ${entries.length}`,
          }
        : { name, passed: true },
    );
  }

  const build = await runner.run(DOCS_BUILD_COMMAND);
  checks.push(
    build.exitCode === 0
      ? { name: 'docs build', passed: true }
      : { name: 'docs build', passed: false, reason: `${DOCS_BUILD_COMMAND} failed` },
  );

  return { checks };
};

// Walks the same markers blockRegions does, but rebuilds the document around each region so a
// rewrite can be handed back in place. An unclosed block ends the walk with the rest of the
// document untouched: the check already fails it by name, and a sync that guessed where the
// block ended would be guessing with someone's prose.
const mapBlocks = (content: string, rewrite: (region: string) => string): string => {
  let rest = content;
  let out = '';
  for (;;) {
    const open = rest.indexOf(OPEN_MARKER);
    if (open === -1) {
      return out + rest;
    }
    const afterOpen = rest.slice(open + OPEN_MARKER.length);
    const close = afterOpen.indexOf(CLOSE_MARKER);
    if (close === -1) {
      return out + rest;
    }
    out += rest.slice(0, open) + OPEN_MARKER + rewrite(afterOpen.slice(0, close)) + CLOSE_MARKER;
    rest = afterOpen.slice(close + CLOSE_MARKER.length);
  }
};

// A namespace import is the one form the exports map alone can justify: it needs the specifier
// and nothing else. The local name is the last segment, camel-cased past any character an
// identifier cannot carry.
const importLineFor = (specifier: string): string => {
  const [first = specifier, ...rest] = (specifier.split('/').at(-1) ?? specifier).split(
    /[^a-zA-Z0-9]+/,
  );
  const local = [first, ...rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1))].join(
    '',
  );
  return `import * as ${local} from '${specifier}';`;
};

// Both edits to a block are line surgery on the specifiers it already lists: a line naming a
// specifier the exports no longer declare goes, and a specifier no line names arrives after the
// last one that survived. Lines naming another package are not the block's business — the check
// ignores them, and so does this.
const syncedBlock = (region: string, pkg: string, entries: string[]): string => {
  const kept = region
    .split('\n')
    .filter((line) => specifiersIn(line, pkg).every((specifier) => entries.includes(specifier)));
  const documented = new Set(specifiersIn(kept.join('\n'), pkg));
  const missing = entries.filter((entry) => !documented.has(entry));
  const lastImport = kept.reduce(
    (found, line, index) => (specifiersIn(line, pkg).length > 0 ? index : found),
    -1,
  );
  kept.splice(lastImport + 1, 0, ...missing.map(importLineFor));
  return kept.join('\n');
};

// A page the tool can write without knowing anything it does not know: the import line it can
// derive, and a TODO everywhere prose belongs. The sidebar is code the sync will not touch, so
// the line a human has to add is spelled out rather than written.
const stubFor = (specifier: string): DocsFile => {
  const name = specifier.split('/').at(-1) ?? specifier;
  return {
    path: `docs/${name}.md`,
    content: [
      `# ${specifier}`,
      '',
      '```ts',
      importLineFor(specifier),
      '',
      '// TODO: an example that runs.',
      '```',
      '',
      '## What works today',
      '',
      '- TODO: what a reader can rely on today, not what is planned.',
      '',
      '<!-- TODO: add this page to the sidebar in docs/.vitepress/config.mts:',
      `     { text: '${name}', link: '/${name}' } -->`,
      '',
    ].join('\n'),
  };
};

const wordForCount = (count: number): string | undefined =>
  Object.entries(COUNT_WORDS).find(([, value]) => value === count)?.[0];

// A claim is rewritten in the form it was written: a digit stays a digit, a word stays a word
// carrying the case it had. Past ten the table has no word, so the claim becomes a digit — the
// same number the check reads either way.
const countAs = (written: string, count: number): string => {
  const word = wordForCount(count);
  if (/^\d+$/.test(written) || word === undefined) {
    return String(count);
  }
  return written.charAt(0) === written.charAt(0).toUpperCase()
    ? word.charAt(0).toUpperCase() + word.slice(1)
    : word;
};

const syncedCounts = (content: string, count: number): string =>
  content.replace(countClaims(), (claim: string) => {
    const written = claim.split(/[\s-]/)[0] ?? '';
    return countAs(written, count) + claim.slice(written.length);
  });

// The mechanical half of the drift the check names: the same inputs, and instead of a report
// the files whose content should change, each as a whole new body. The shell does the writing,
// so the policy stays pure — and a file this would leave alone never reaches the caller, which
// is what makes a second run against a repo already in step write nothing.
export const docsSync = ({
  pkg,
  exports,
  files,
}: {
  pkg: string;
  exports: unknown;
  files: DocsFile[];
}): DocsSyncResult => {
  const entries = entryPointsFrom(pkg, exports);
  const scanned = files.filter((file) => !file.path.split('/').includes('.vitepress'));
  const edits: DocsFile[] = [];
  for (const file of scanned) {
    const synced = mapBlocks(file.content, (region) => syncedBlock(region, pkg, entries));
    const content = syncedCounts(synced, entries.length);
    if (content !== file.content) {
      edits.push({ path: file.path, content });
    }
  }

  // What the docs declared before this run is the baseline a stub is new against. An unclosed
  // block declares nothing readable and a repo with no block at all has no baseline, so neither
  // gets scaffolded: both are failures the check already names, and guessing past them would
  // stamp pages across a repo on the strength of a marker somebody forgot to close.
  const readable = scanned
    .map((file) => blockRegions(file.content))
    .filter((block) => !block.unclosed && block.regions.length > 0);
  const declared = new Set(
    readable.flatMap((block) => block.regions.flatMap((region) => specifiersIn(region, pkg))),
  );
  const existing = new Set(files.map((file) => file.path));
  if (readable.length > 0) {
    for (const entry of entries.filter((entry) => entry !== pkg && !declared.has(entry))) {
      const stub = stubFor(entry);
      if (!existing.has(stub.path)) {
        edits.push(stub);
      }
    }
  }
  return { edits };
};
