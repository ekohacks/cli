#!/usr/bin/env node
// The thin shell: read the repo's files, wire the real wrappers, print one line per
// check and per step, exit 0 only when the command ran to its end. Everything worth
// testing lives below.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { GhWrapper } from './infrastructure/gh.ts';
import { GitWrapper } from './infrastructure/git.ts';
import { LinearWrapper } from './infrastructure/linear.ts';
import { NpmWrapper } from './infrastructure/npm.ts';
import { ProcessRunner } from './infrastructure/process.ts';
import { ClaudeWrapper } from './infrastructure/claude.ts';
import { cut } from './logic/cut.ts';
import {
  docsCheck,
  docsDraft,
  docsSync,
  draftBranchConflict,
  draftPrompts,
  openDraftPr,
  type DocsFile,
} from './logic/docs.ts';
import { preflight } from './logic/preflight.ts';
import { release } from './logic/release.ts';
import { ship } from './logic/ship.ts';
import {
  storiesArchive,
  storiesCreate,
  storiesFetch,
  storyLine,
  type BacklogStory,
} from './logic/stories.ts';

const USAGE = [
  'usage: ekohacks release [preflight|cut|ship] <version> [--yes]',
  '       ekohacks docs check',
  '       ekohacks docs sync [--dry-run]',
  '       ekohacks docs draft [--yes]',
  '       ekohacks stories fetch <team> <column> [out.json]',
  '       ekohacks stories archive <team> <column> [--yes]',
  '       ekohacks stories create <team> <backlog.json> [--yes] [--dry-run]',
].join('\n');

const FLAGS = ['--yes', '--dry-run'];

const argv = process.argv.slice(2);
const yes = argv.includes('--yes');
const dryRun = argv.includes('--dry-run');
const [command, ...rest] = argv.filter((arg) => !FLAGS.includes(arg));

const printChecks = (checks: { name: string; passed: boolean; reason?: string }[]) => {
  for (const check of checks) {
    console.log(check.passed ? `  ok    ${check.name}` : `  FAIL  ${check.name}: ${check.reason}`);
  }
};

const confirm = async (question: string) => {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await readline.question(`${question} (y/n) `);
  readline.close();
  return answer.trim().toLowerCase() === 'y';
};
const narrate = (line: string) => console.log(`  ${line}`);

if (command === 'docs') {
  const subject = rest[0];
  if (rest.length !== 1 || (subject !== 'check' && subject !== 'sync' && subject !== 'draft')) {
    console.error(USAGE);
    process.exit(2);
  }
  if (!existsSync('package.json')) {
    console.error('stopped: no package.json in this directory');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
    name: string;
    exports?: unknown;
  };
  const files: DocsFile[] = [];
  if (existsSync('README.md')) {
    files.push({ path: 'README.md', content: readFileSync('README.md', 'utf8') });
  }
  if (existsSync('docs')) {
    for (const entry of readdirSync('docs', { recursive: true, encoding: 'utf8' }).sort()) {
      if (entry.endsWith('.md')) {
        files.push({ path: `docs/${entry}`, content: readFileSync(`docs/${entry}`, 'utf8') });
      }
    }
  }
  if (subject === 'sync') {
    const { edits } = docsSync({ pkg: manifest.name, exports: manifest.exports, files });
    if (edits.length === 0) {
      console.log('  the docs are already in step');
      process.exit(0);
    }
    for (const edit of edits) {
      const verb = existsSync(edit.path) ? 'updated' : 'created';
      if (!dryRun) {
        mkdirSync(dirname(edit.path), { recursive: true });
        writeFileSync(edit.path, edit.content);
      }
      console.log(`  ${dryRun ? `would have ${verb}` : verb} ${edit.path}`);
    }
    process.exit(0);
  }

  if (subject === 'draft') {
    if (process.env.ANTHROPIC_API_KEY === undefined || process.env.ANTHROPIC_API_KEY === '') {
      console.error('stopped: docs draft needs ANTHROPIC_API_KEY');
      process.exit(1);
    }
    const prompts = draftPrompts({ pkg: manifest.name, exports: manifest.exports, files });
    if (prompts.length === 0) {
      console.log('  nothing to draft: no page carries a draft block');
      process.exit(0);
    }
    // The PR branch is checked before the model runs, not after: a repeat run stops here for
    // free rather than spending on drafts it could never open. The same wrapper opens the PR.
    const git = GitWrapper.create();
    const conflict = await draftBranchConflict(git);
    if (conflict !== undefined) {
      console.error(`stopped: ${conflict}`);
      process.exit(1);
    }
    const pages = `${prompts.length} page${prompts.length === 1 ? '' : 's'}`;
    console.log(`  ${pages} to draft, one model call each:`);
    for (const { specifier } of prompts) {
      console.log(`    ${specifier}`);
    }
    if (!yes) {
      const readline = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await readline.question(`  draft ${pages}? (y/n) `);
      readline.close();
      if (answer.trim().toLowerCase() !== 'y') {
        console.error('stopped: draft not approved');
        process.exit(1);
      }
    }
    let claude: ClaudeWrapper;
    try {
      claude = await ClaudeWrapper.create();
    } catch (error) {
      console.error(`stopped: ${(error as Error).message}`);
      process.exit(1);
    }
    const { edits } = await docsDraft({
      pkg: manifest.name,
      exports: manifest.exports,
      files,
      claude,
    });
    for (const edit of edits) {
      writeFileSync(edit.path, edit.content);
      console.log(`  drafted ${edit.path}`);
    }
    const pr = await openDraftPr({
      specifiers: prompts.map((prompt) => prompt.specifier),
      git,
      gh: GhWrapper.create(),
    });
    if ('stopped' in pr) {
      console.error(`stopped: ${pr.stopped}`);
      process.exit(1);
    }
    console.log(`  opened pr #${pr.number}`);
    process.exit(0);
  }

  const report = await docsCheck({
    pkg: manifest.name,
    exports: manifest.exports,
    files,
    runner: ProcessRunner.create(),
  });
  printChecks(report.checks);
  process.exit(report.checks.every((check) => check.passed) ? 0 : 1);
}

if (command === 'stories') {
  const subject = rest[0];
  const team = rest[1];
  const target = rest[2];
  const shapeOk =
    team !== undefined &&
    target !== undefined &&
    ((subject === 'fetch' && rest.length <= 4) ||
      (subject === 'archive' && rest.length === 3) ||
      (subject === 'create' && rest.length === 3));
  if (!shapeOk) {
    console.error(USAGE);
    process.exit(2);
  }
  if (process.env.LINEAR_API_KEY === undefined || process.env.LINEAR_API_KEY === '') {
    console.error(`stopped: stories ${subject} needs LINEAR_API_KEY`);
    process.exit(1);
  }
  const linear = LinearWrapper.create();
  const approve = yes ? () => Promise.resolve(true) : confirm;
  try {
    if (subject === 'fetch') {
      const out = rest[3];
      const { stories } = await storiesFetch({ team, column: target, linear, narrate });
      for (const story of stories) {
        console.log(storyLine(story));
      }
      if (out !== undefined) {
        writeFileSync(out, `${JSON.stringify(stories, null, 2)}\n`);
        narrate(`${stories.length} stories written to ${out}`);
      }
      process.exit(0);
    }
    if (subject === 'archive') {
      const result = await storiesArchive({
        team,
        column: target,
        linear,
        confirm: approve,
        narrate,
      });
      if ('stopped' in result) {
        console.error(`stopped: ${result.stopped}`);
        process.exit(1);
      }
      process.exit(0);
    }
    if (!existsSync(target)) {
      console.error(`stopped: no ${target} in this directory`);
      process.exit(1);
    }
    let backlog: BacklogStory[];
    try {
      const parsed = JSON.parse(readFileSync(target, 'utf8')) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('not a list');
      }
      backlog = parsed as BacklogStory[];
    } catch {
      console.error(`stopped: ${target} is not a JSON list of stories`);
      process.exit(1);
    }
    const result = await storiesCreate({
      team,
      backlog,
      linear,
      confirm: approve,
      narrate,
      dryRun,
    });
    if ('stopped' in result) {
      console.error(`stopped: ${result.stopped}`);
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error(`stopped: ${(error as Error).message}`);
    process.exit(1);
  }
}

const first = rest[0];
const subcommand = first === 'preflight' || first === 'cut' || first === 'ship' ? first : undefined;
const version = subcommand === undefined ? first : rest[1];

if (command !== 'release' || version === undefined) {
  console.error(USAGE);
  process.exit(2);
}

for (const file of ['CHANGELOG.md', 'package.json', 'package-lock.json']) {
  if (!existsSync(file)) {
    console.error(`stopped: no ${file} in this directory`);
    process.exit(1);
  }
}

const read = (file: string) => readFileSync(file, 'utf8');
const changelog = read('CHANGELOG.md');
const manifest = JSON.parse(read('package.json')) as { name: string; version: string };
const pkg = manifest.name;

if (subcommand === undefined) {
  const result = await release({
    version,
    changelog,
    lockfile: read('package-lock.json'),
    pkg,
    git: GitWrapper.create(),
    npm: NpmWrapper.create(),
    gh: GhWrapper.create(),
    runner: ProcessRunner.create(),
    confirm,
    narrate,
    yes,
    currentVersion: manifest.version,
  });

  if ('stopped' in result) {
    console.error(`stopped: ${result.stopped}`);
    process.exit(1);
  }
  process.exit(0);
}

if (subcommand === 'ship') {
  const result = await ship({
    version,
    changelog,
    pkg,
    gh: GhWrapper.create(),
    git: GitWrapper.create(),
    npm: NpmWrapper.create(),
    confirm,
    narrate,
  });

  if ('stopped' in result) {
    console.error(`stopped: ${result.stopped}`);
    process.exit(1);
  }
  process.exit(0);
}

const report = await preflight({
  version,
  pkg,
  changelog,
  lockfile: read('package-lock.json'),
  npm: NpmWrapper.create(),
  git: GitWrapper.create(),
  runner: ProcessRunner.create(),
});

printChecks(report.checks);

if (subcommand === 'preflight') {
  process.exit(report.checks.every((check) => check.passed) ? 0 : 1);
}

const result = await cut({
  version,
  changelog,
  report,
  git: GitWrapper.create(),
  npm: NpmWrapper.create(),
  gh: GhWrapper.create(),
  narrate,
  currentVersion: manifest.version,
});

if ('stopped' in result) {
  console.error(`stopped: ${result.stopped}`);
  process.exit(1);
}
process.exit(0);
