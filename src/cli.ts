#!/usr/bin/env node
// The thin shell: read the repo's files, wire the real wrappers, print one line per
// check, exit 0 only when every check passes. Everything worth testing lives below.
import { readFileSync } from 'node:fs';
import { GitWrapper } from './infrastructure/git.ts';
import { NpmWrapper } from './infrastructure/npm.ts';
import { ProcessRunner } from './infrastructure/process.ts';
import { preflight } from './logic/preflight.ts';

const [command, subcommand, version] = process.argv.slice(2);

if (command !== 'release' || subcommand !== 'preflight' || version === undefined) {
  console.error('usage: ekohacks release preflight <version>');
  process.exit(2);
}

const read = (file: string) => readFileSync(file, 'utf8');
const pkg = (JSON.parse(read('package.json')) as { name: string }).name;

const report = await preflight({
  version,
  pkg,
  changelog: read('CHANGELOG.md'),
  lockfile: read('package-lock.json'),
  npm: NpmWrapper.create(),
  git: GitWrapper.create(),
  runner: ProcessRunner.create(),
});

for (const check of report.checks) {
  console.log(check.passed ? `  ok    ${check.name}` : `  FAIL  ${check.name}: ${check.reason}`);
}
process.exit(report.checks.every((check) => check.passed) ? 0 : 1);
