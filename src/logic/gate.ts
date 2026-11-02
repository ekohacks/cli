// The gate contract of observatory ADR 0023 as a check: one script that the pre-push
// hook, the README and CI all call, whole; coverage as information; a contract list for
// every wrapper with a narrow test. The caller supplies file contents and the tracked
// paths; the policy only judges, and every drift is a named check with the reason a
// human needs to fix it. Nothing here runs a command.

export interface RepoFile {
  path: string;
  content: string;
}

export interface GateReport {
  checks: { name: string; passed: boolean; reason?: string }[];
}

type Check = GateReport['checks'][number];

const WORKFLOW_DIRS = ['.github/workflows/', '.forgejo/workflows/', '.gitea/workflows/'];
const HUSKY_HOOK = '.husky/pre-push';
const PRE_COMMIT = '.pre-commit-config.yaml';
const PRETTIER_TRACKED = 'git ls-files -z | xargs -0 prettier --check --ignore-unknown';
const RUFF_TRACKED = 'git ls-files -z -- src tests | xargs -0 ruff format --check';

// What the gate is in this repository: `npm run gate` when package.json has the script, a
// gate.sh otherwise. `text` is the gate with every script it names expanded one level, so a
// gate written as `run-p typecheck lint test` is judged by what those scripts run.
interface Gate {
  kind: 'node' | 'script';
  command: string;
  path: string;
  text: string;
  scripts: Record<string, string>;
}

const scriptsOf = (manifest: string): Record<string, string> => {
  try {
    const parsed = JSON.parse(manifest) as { scripts?: Record<string, string> };
    return parsed.scripts ?? {};
  } catch {
    return {};
  }
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A script is named by the gate when it appears as a word: `npm test`, `npm run lint`, or a
// bare `lint` in a runner's list. `test` does not name `test:changed`.
const names = (text: string, script: string) =>
  new RegExp(`(^|[\\s"'])${escapeRegExp(script)}($|[\\s"'&|;])`, 'm').test(text);

const findGate = (files: RepoFile[]): Gate | undefined => {
  const manifest = files.find((file) => file.path === 'package.json');
  const scripts = manifest === undefined ? {} : scriptsOf(manifest.content);
  const gate = scripts['gate'];
  if (gate !== undefined) {
    const named = Object.entries(scripts)
      .filter(([name]) => name !== 'gate' && names(gate, name))
      .map(([, text]) => text);
    return {
      kind: 'node',
      command: 'npm run gate',
      path: 'package.json',
      text: [gate, ...named].join('\n'),
      scripts,
    };
  }
  const script = files.find((file) => file.path === 'gate.sh' || file.path.endsWith('/gate.sh'));
  if (script !== undefined) {
    return {
      kind: 'script',
      command: script.path,
      path: script.path,
      text: script.content,
      scripts,
    };
  }
  return undefined;
};

const pass = (name: string): Check => ({ name, passed: true });
const fail = (name: string, reason: string): Check => ({ name, passed: false, reason });

const quoted = (lines: string[]) => lines.map((line) => `"${line}"`).join(', ');

const wholeSuite = (gate: Gate): Check => {
  const name = 'gate runs the whole suite';
  const shortcut = gate.text.split('\n').find((line) => line.includes('--changed'));
  const suite = gate.kind === 'node' ? 'npm test' : 'pytest';
  if (shortcut !== undefined) {
    return fail(name, `the gate runs "${shortcut.trim()}"; the whole suite is ${suite}`);
  }
  const runs =
    gate.kind === 'node'
      ? names(gate.text, 'test') || gate.text.includes('vitest run')
      : gate.text.includes('pytest');
  return runs ? pass(name) : fail(name, `the gate does not run the suite (${suite})`);
};

const typeChecks = (gate: Gate): Check =>
  names(gate.text, 'typecheck') || /\btsc\b/.test(gate.text)
    ? pass('gate type-checks')
    : fail('gate type-checks', 'the gate does not run the type check (npm run typecheck)');

const lints = (gate: Gate): Check => {
  const name = 'gate lints';
  if (gate.kind === 'node') {
    if (gate.scripts['lint'] === undefined || names(gate.text, 'lint')) {
      return pass(name);
    }
    return fail(name, 'package.json has a lint script the gate does not run');
  }
  return /ruff check|flake8|pylint/.test(gate.text)
    ? pass(name)
    : fail(name, 'the gate does not lint (ruff check)');
};

const checksFormatting = (gate: Gate): Check => {
  const name = 'gate checks formatting';
  if (gate.kind === 'node') {
    return names(gate.text, 'format:check') || gate.text.includes('prettier --check')
      ? pass(name)
      : fail(name, 'the gate does not check formatting (format:check, prettier --check)');
  }
  return /ruff format --check|black --check/.test(gate.text)
    ? pass(name)
    : fail(name, 'the gate does not check formatting (ruff format --check)');
};

const readsTrackedFiles = (gate: Gate): Check => {
  const name = 'format check reads tracked files';
  if (gate.kind === 'node') {
    const everything = gate.text.split('\n').find((line) => /prettier --check \.(\s|$)/.test(line));
    return everything === undefined
      ? pass(name)
      : fail(
          name,
          `format:check runs "${everything.trim()}", which reads untracked files too; read tracked files: ${PRETTIER_TRACKED}`,
        );
  }
  const format = gate.text.split('\n').find((line) => line.includes('ruff format --check'));
  return format === undefined || format.includes('git ls-files')
    ? pass(name)
    : fail(
        name,
        `${gate.path} runs ruff format --check on directories, which reads untracked files too; read tracked files: ${RUFF_TRACKED}`,
      );
};

const prePush = (gate: Gate, files: RepoFile[]): Check => {
  const name = 'pre-push runs the gate';
  const husky = files.find((file) => file.path === HUSKY_HOOK);
  if (husky !== undefined) {
    const lines = husky.content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
    return lines.some((line) => line.includes(gate.command))
      ? pass(name)
      : fail(name, `${HUSKY_HOOK} runs ${quoted(lines)}, not ${gate.command}`);
  }
  const preCommit = files.find((file) => file.path === PRE_COMMIT);
  if (preCommit !== undefined) {
    return preCommit.content.includes(`entry: ${gate.path}`) &&
      preCommit.content.includes('pre-push')
      ? pass(name)
      : fail(name, `${PRE_COMMIT} has no pre-push hook whose entry is ${gate.path}`);
  }
  return fail(name, `no ${HUSKY_HOOK} and no ${PRE_COMMIT}`);
};

const ciRuns = (gate: Gate, files: RepoFile[]): Check => {
  const name = 'CI runs the gate';
  const workflows = files.filter((file) => WORKFLOW_DIRS.some((dir) => file.path.startsWith(dir)));
  if (workflows.length === 0) {
    return fail(
      name,
      'no workflow under .github/workflows, .forgejo/workflows or .gitea/workflows',
    );
  }
  const token = gate.kind === 'node' ? gate.command : 'gate.sh';
  return workflows.some((file) => file.content.includes(token))
    ? pass(name)
    : fail(
        name,
        `no workflow (${workflows.map((file) => file.path).join(', ')}) runs ${gate.command}`,
      );
};

const readmeNames = (gate: Gate, files: RepoFile[]): Check => {
  const name = 'README names the gate';
  const readme = files.find((file) => file.path === 'README.md');
  if (readme === undefined) {
    return fail(name, 'no README.md');
  }
  return readme.content.includes(gate.command)
    ? pass(name)
    : fail(name, `README.md does not name ${gate.command}`);
};

const coverageNeverGates = (files: RepoFile[]): Check => {
  const name = 'coverage is never a gate';
  for (const file of files) {
    const culprit = file.content.includes('--cov-fail-under')
      ? '--cov-fail-under'
      : /\bfail_under\s*=/.test(file.content)
        ? 'fail_under'
        : /vitest\.config\.[cm]?[jt]s$/.test(file.path) && /\bthresholds\s*:/.test(file.content)
          ? 'thresholds'
          : undefined;
    if (culprit !== undefined) {
      return fail(
        name,
        `${file.path} makes coverage a gate (${culprit}); coverage is information (ADR 0012)`,
      );
    }
  }
  return pass(name);
};

// A wrapper's narrow test sits in an infrastructure directory as <name>.integration.test.ts;
// its contract list is <name>Contract.ts beside it, compared without case and without any
// -suffix, so websocket-fastify finds webSocketContract. Only TypeScript repositories are
// judged: the Python convention is still to be written (gate plan card 39).
const contractLists = (paths: string[]): Check => {
  const name = 'contract lists';
  const lower = new Set(paths.map((path) => path.toLowerCase()));
  const missing: string[] = [];
  for (const path of paths) {
    const match = /^(.*\/infrastructure\/)([^/]+)\.integration\.test\.ts$/.exec(path);
    if (match === null) {
      continue;
    }
    const [, dir = '', file = ''] = match;
    const stem = file.split('-')[0] ?? file;
    const contract = `${dir}${stem}Contract.ts`;
    if (!lower.has(contract.toLowerCase())) {
      missing.push(`${path} wants ${contract}`);
    }
  }
  return missing.length === 0
    ? pass(name)
    : fail(name, `narrow tests without a contract list: ${missing.join('; ')}`);
};

export const gateCheck = ({ files, paths }: { files: RepoFile[]; paths: string[] }): GateReport => {
  const gate = findGate(files);
  if (gate === undefined) {
    return {
      checks: [fail('gate script', 'package.json has no scripts.gate and there is no gate.sh')],
    };
  }
  const checks: Check[] = [pass('gate script'), wholeSuite(gate)];
  if (gate.kind === 'node') {
    checks.push(typeChecks(gate));
  }
  checks.push(
    lints(gate),
    checksFormatting(gate),
    readsTrackedFiles(gate),
    prePush(gate, files),
    ciRuns(gate, files),
    readmeNames(gate, files),
    coverageNeverGates(files),
  );
  if (gate.kind === 'node') {
    checks.push(contractLists(paths));
  }
  return { checks };
};
