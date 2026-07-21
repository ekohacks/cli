#!/usr/bin/env node
// The thin shell: read the repo's files, wire the real wrappers, print one line per
// check and per step, exit 0 only when the command ran to its end. Everything worth
// testing lives below.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { GhWrapper } from './infrastructure/gh.ts';
import { GitWrapper } from './infrastructure/git.ts';
import { NpmWrapper } from './infrastructure/npm.ts';
import { ProcessRunner } from './infrastructure/process.ts';
import { cut } from './logic/cut.ts';
import { preflight } from './logic/preflight.ts';
import { ship } from './logic/ship.ts';

const [command, subcommand, version] = process.argv.slice(2);

if (
  command !== 'release' ||
  (subcommand !== 'preflight' && subcommand !== 'cut' && subcommand !== 'ship') ||
  version === undefined
) {
  console.error('usage: ekohacks release <preflight|cut|ship> <version>');
  process.exit(2);
}

const read = (file: string) => readFileSync(file, 'utf8');
const changelog = read('CHANGELOG.md');
const pkg = (JSON.parse(read('package.json')) as { name: string }).name;

if (subcommand === 'ship') {
  const confirm = async (question: string) => {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await readline.question(`${question} (y/n) `);
    readline.close();
    return answer.trim().toLowerCase() === 'y';
  };

  const result = await ship({
    version,
    changelog,
    pkg,
    gh: GhWrapper.create(),
    npm: NpmWrapper.create(),
    confirm,
    narrate: (line) => console.log(`  ${line}`),
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

for (const check of report.checks) {
  console.log(check.passed ? `  ok    ${check.name}` : `  FAIL  ${check.name}: ${check.reason}`);
}

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
  narrate: (line) => console.log(`  ${line}`),
});

if ('stopped' in result) {
  console.error(`stopped: ${result.stopped}`);
  process.exit(1);
}
process.exit(0);
