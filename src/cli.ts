#!/usr/bin/env node
// The thin shell: read the repo's files, wire the real wrappers, print one line per
// check and per step, exit 0 only when the command ran to its end. Everything worth
// testing lives below.
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { GhWrapper } from './infrastructure/gh.ts';
import { GitWrapper } from './infrastructure/git.ts';
import { NpmWrapper } from './infrastructure/npm.ts';
import { ProcessRunner } from './infrastructure/process.ts';
import { cut } from './logic/cut.ts';
import { preflight } from './logic/preflight.ts';
import { release } from './logic/release.ts';
import { ship } from './logic/ship.ts';

const argv = process.argv.slice(2);
const yes = argv.includes('--yes');
const [command, ...rest] = argv.filter((arg) => arg !== '--yes');

const first = rest[0];
const subcommand = first === 'preflight' || first === 'cut' || first === 'ship' ? first : undefined;
const version = subcommand === undefined ? first : rest[1];

if (command !== 'release' || version === undefined) {
  console.error('usage: ekohacks release [preflight|cut|ship] <version> [--yes]');
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

const confirm = async (question: string) => {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await readline.question(`${question} (y/n) `);
  readline.close();
  return answer.trim().toLowerCase() === 'y';
};
const narrate = (line: string) => console.log(`  ${line}`);

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
  narrate,
  currentVersion: manifest.version,
});

if ('stopped' in result) {
  console.error(`stopped: ${result.stopped}`);
  process.exit(1);
}
process.exit(0);
