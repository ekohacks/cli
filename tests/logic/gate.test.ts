import { describe, expect, it } from 'vitest';
import { gateCheck, type RepoFile } from '../../src/logic/gate.ts';

const SCRIPTS = {
  typecheck: 'tsc --noEmit',
  lint: 'eslint .',
  'format:check': 'git ls-files -z | xargs -0 prettier --check --ignore-unknown',
  test: 'vitest run',
  gate: 'npm run typecheck && npm run lint && npm run format:check && npm test',
};

const packageJson = (scripts: Record<string, string>): RepoFile => ({
  path: 'package.json',
  content: JSON.stringify({ name: 'observatory', scripts }, null, 2),
});

const NODE_FILES: RepoFile[] = [
  packageJson(SCRIPTS),
  { path: 'README.md', content: 'The gate is one command, `npm run gate`.\n' },
  { path: '.husky/pre-push', content: 'npm run gate\n' },
  { path: '.github/workflows/ci.yml', content: 'steps:\n  - run: npm ci\n  - run: npm run gate\n' },
];

const NODE_PATHS = [
  'src/infrastructure/httpClient.ts',
  'src/infrastructure/httpClientContract.ts',
  'src/infrastructure/httpClient.integration.test.ts',
  'src/infrastructure/httpClient.test.ts',
];

const PYTHON_FILES: RepoFile[] = [
  {
    path: 'backend/gate.sh',
    content: [
      '#!/usr/bin/env bash',
      'git ls-files -z -- src tests | xargs -0 ruff check',
      'git ls-files -z -- src tests | xargs -0 ruff format --check',
      'pytest tests -q',
    ].join('\n'),
  },
  {
    path: '.pre-commit-config.yaml',
    content: [
      'repos:',
      '  - repo: local',
      '    hooks:',
      '      - id: gate',
      '        entry: backend/gate.sh',
      '        stages: [pre-push]',
    ].join('\n'),
  },
  { path: 'README.md', content: 'The gate is `backend/gate.sh`.\n' },
  { path: '.github/workflows/backend.yml', content: 'steps:\n  - run: ./gate.sh\n' },
];

const without = (files: RepoFile[], path: string) => files.filter((file) => file.path !== path);
const replacing = (files: RepoFile[], file: RepoFile) => [...without(files, file.path), file];

const check = (report: { checks: { name: string }[] }, name: string) =>
  report.checks.find((entry) => entry.name === name);

describe('gate check', () => {
  it('passes every check on a repo whose hook, README and CI call one whole gate', () => {
    const report = gateCheck({ files: NODE_FILES, paths: NODE_PATHS });

    expect(report.checks.map((entry) => entry.name)).toEqual([
      'gate script',
      'gate runs the whole suite',
      'gate type-checks',
      'gate lints',
      'gate checks formatting',
      'format check reads tracked files',
      'pre-push runs the gate',
      'CI runs the gate',
      'README names the gate',
      'coverage is never a gate',
      'contract lists',
    ]);
    expect(report.checks.every((entry) => entry.passed)).toBe(true);
  });

  it('fails the gate script check, and only that, when nothing is the gate', () => {
    const report = gateCheck({
      files: replacing(NODE_FILES, packageJson({ test: 'vitest run' })),
      paths: NODE_PATHS,
    });

    expect(report.checks).toEqual([
      {
        name: 'gate script',
        passed: false,
        reason: 'package.json has no scripts.gate and there is no gate.sh',
      },
    ]);
  });

  it('fails the whole-suite check when the gate runs the changed-only shortcut', () => {
    const scripts = {
      ...SCRIPTS,
      'test:changed': 'vitest run --changed origin/main',
      gate: 'npm run typecheck && npm run test:changed',
    };

    const report = gateCheck({
      files: replacing(NODE_FILES, packageJson(scripts)),
      paths: NODE_PATHS,
    });

    expect(check(report, 'gate runs the whole suite')).toEqual({
      name: 'gate runs the whole suite',
      passed: false,
      reason: 'the gate runs "vitest run --changed origin/main"; the whole suite is npm test',
    });
  });

  it('fails the whole-suite check when the gate never runs the suite', () => {
    const scripts = { ...SCRIPTS, gate: 'npm run typecheck && npm run format:check' };

    const report = gateCheck({
      files: replacing(NODE_FILES, packageJson(scripts)),
      paths: NODE_PATHS,
    });

    expect(check(report, 'gate runs the whole suite')).toEqual({
      name: 'gate runs the whole suite',
      passed: false,
      reason: 'the gate does not run the suite (npm test)',
    });
  });

  it('fails the type-check and lint checks when the gate skips scripts the repo has', () => {
    const scripts = { ...SCRIPTS, gate: 'npm run format:check && npm test' };

    const report = gateCheck({
      files: replacing(NODE_FILES, packageJson(scripts)),
      paths: NODE_PATHS,
    });

    expect(check(report, 'gate type-checks')).toEqual({
      name: 'gate type-checks',
      passed: false,
      reason: 'the gate does not run the type check (npm run typecheck)',
    });
    expect(check(report, 'gate lints')).toEqual({
      name: 'gate lints',
      passed: false,
      reason: 'package.json has a lint script the gate does not run',
    });
  });

  it('passes the lint check for a repo with no lint script, as the CLI itself', () => {
    const { lint: _lint, ...scripts } = SCRIPTS;

    const report = gateCheck({
      files: replacing(
        NODE_FILES,
        packageJson({ ...scripts, gate: 'npm run typecheck && npm run format:check && npm test' }),
      ),
      paths: NODE_PATHS,
    });

    expect(check(report, 'gate lints')).toEqual({ name: 'gate lints', passed: true });
  });

  it('reads scripts the gate names through a parallel runner', () => {
    const scripts = {
      ...SCRIPTS,
      gate: 'run-p --aggregate-output typecheck lint format:check test',
    };

    const report = gateCheck({
      files: replacing(NODE_FILES, packageJson(scripts)),
      paths: NODE_PATHS,
    });

    expect(report.checks).toHaveLength(11);
    expect(report.checks.filter((entry) => !entry.passed)).toEqual([]);
  });

  it('fails the formatting check when the gate has no format check', () => {
    const scripts = { ...SCRIPTS, gate: 'npm run typecheck && npm run lint && npm test' };

    const report = gateCheck({
      files: replacing(NODE_FILES, packageJson(scripts)),
      paths: NODE_PATHS,
    });

    expect(check(report, 'gate checks formatting')).toEqual({
      name: 'gate checks formatting',
      passed: false,
      reason: 'the gate does not check formatting (format:check, prettier --check)',
    });
  });

  it('fails the tracked-files check when prettier reads every file on disk', () => {
    const scripts = { ...SCRIPTS, 'format:check': 'prettier --check .' };

    const report = gateCheck({
      files: replacing(NODE_FILES, packageJson(scripts)),
      paths: NODE_PATHS,
    });

    expect(check(report, 'format check reads tracked files')).toEqual({
      name: 'format check reads tracked files',
      passed: false,
      reason:
        'format:check runs "prettier --check .", which reads untracked files too; read tracked files: git ls-files -z | xargs -0 prettier --check --ignore-unknown',
    });
  });

  it('fails the pre-push check when the hook runs something else', () => {
    const hook = {
      path: '.husky/pre-push',
      content: '# husky\nnpm run typecheck\nnpm run test:changed\n',
    };

    const report = gateCheck({ files: replacing(NODE_FILES, hook), paths: NODE_PATHS });

    expect(check(report, 'pre-push runs the gate')).toEqual({
      name: 'pre-push runs the gate',
      passed: false,
      reason: '.husky/pre-push runs "npm run typecheck", "npm run test:changed", not npm run gate',
    });
  });

  it('fails the pre-push check when there is no hook at all', () => {
    const report = gateCheck({ files: without(NODE_FILES, '.husky/pre-push'), paths: NODE_PATHS });

    expect(check(report, 'pre-push runs the gate')).toEqual({
      name: 'pre-push runs the gate',
      passed: false,
      reason: 'no .husky/pre-push and no .pre-commit-config.yaml',
    });
  });

  it('fails the CI check when no workflow runs the gate', () => {
    const ci = { path: '.github/workflows/ci.yml', content: 'steps:\n  - run: npm test\n' };

    const report = gateCheck({ files: replacing(NODE_FILES, ci), paths: NODE_PATHS });

    expect(check(report, 'CI runs the gate')).toEqual({
      name: 'CI runs the gate',
      passed: false,
      reason: 'no workflow (.github/workflows/ci.yml) runs npm run gate',
    });
  });

  it('fails the CI check when there is no workflow at all', () => {
    const report = gateCheck({
      files: without(NODE_FILES, '.github/workflows/ci.yml'),
      paths: NODE_PATHS,
    });

    expect(check(report, 'CI runs the gate')).toEqual({
      name: 'CI runs the gate',
      passed: false,
      reason: 'no workflow under .github/workflows, .forgejo/workflows or .gitea/workflows',
    });
  });

  it('fails the README check when the README does not name the gate', () => {
    const readme = { path: 'README.md', content: '# observatory\n\nRun `npm test`.\n' };

    const report = gateCheck({ files: replacing(NODE_FILES, readme), paths: NODE_PATHS });

    expect(check(report, 'README names the gate')).toEqual({
      name: 'README names the gate',
      passed: false,
      reason: 'README.md does not name npm run gate',
    });
  });

  it('fails the coverage check when a threshold can fail the build', () => {
    const config = {
      path: 'vitest.config.ts',
      content: 'export default { test: { coverage: { thresholds: { lines: 80 } } } };\n',
    };

    const report = gateCheck({ files: [...NODE_FILES, config], paths: NODE_PATHS });

    expect(check(report, 'coverage is never a gate')).toEqual({
      name: 'coverage is never a gate',
      passed: false,
      reason:
        'vitest.config.ts makes coverage a gate (thresholds); coverage is information (ADR 0012)',
    });
  });

  it('does not mistake a comment about thresholds for a threshold', () => {
    const config = {
      path: 'vitest.config.ts',
      content: '// no thresholds, so it cannot fail a build\nexport default {};\n',
    };

    const report = gateCheck({ files: [...NODE_FILES, config], paths: NODE_PATHS });

    expect(check(report, 'coverage is never a gate')).toEqual({
      name: 'coverage is never a gate',
      passed: true,
    });
  });

  it('fails the contract check when a wrapper has a narrow test and no contract list', () => {
    const paths = [
      ...NODE_PATHS,
      'tests/infrastructure/git.ts',
      'tests/infrastructure/git.test.ts',
      'tests/infrastructure/git.integration.test.ts',
    ];

    const report = gateCheck({ files: NODE_FILES, paths });

    expect(check(report, 'contract lists')).toEqual({
      name: 'contract lists',
      passed: false,
      reason:
        'narrow tests without a contract list: tests/infrastructure/git.integration.test.ts wants tests/infrastructure/gitContract.ts',
    });
  });

  it('matches a contract list regardless of case and of a suffix after a dash', () => {
    const paths = [
      'tests/infrastructure/webSocketContract.ts',
      'tests/infrastructure/websocket.integration.test.ts',
      'tests/infrastructure/websocket-fastify.integration.test.ts',
      'tests/server/smoke.integration.test.ts',
    ];

    const report = gateCheck({ files: NODE_FILES, paths });

    expect(check(report, 'contract lists')).toEqual({ name: 'contract lists', passed: true });
  });

  it('judges a Python repo by its gate.sh, its pre-commit pre-push hook and CI', () => {
    const report = gateCheck({
      files: PYTHON_FILES,
      paths: ['backend/tests/narrow/test_db_client.py'],
    });

    expect(report.checks.map((entry) => entry.name)).toEqual([
      'gate script',
      'gate runs the whole suite',
      'gate lints',
      'gate checks formatting',
      'format check reads tracked files',
      'pre-push runs the gate',
      'CI runs the gate',
      'README names the gate',
      'coverage is never a gate',
    ]);
    expect(report.checks.every((entry) => entry.passed)).toBe(true);
  });

  it('fails a Python gate that formats directories rather than tracked files', () => {
    const gate = {
      path: 'backend/gate.sh',
      content: 'ruff check src tests\nruff format --check src tests\npytest tests -q\n',
    };

    const report = gateCheck({ files: replacing(PYTHON_FILES, gate), paths: [] });

    expect(check(report, 'format check reads tracked files')).toEqual({
      name: 'format check reads tracked files',
      passed: false,
      reason:
        'backend/gate.sh runs ruff format --check on directories, which reads untracked files too; read tracked files: git ls-files -z -- src tests | xargs -0 ruff format --check',
    });
  });

  it('reads a shell line continued with a backslash as one line', () => {
    const gate = {
      path: 'backend/gate.sh',
      content: [
        "git ls-files -z -- 'src/*.py' | xargs -0 ruff check",
        "git ls-files -z -- 'src/*.py' 'src/*.md' \\",
        '  | xargs -0 ruff format --check',
        'pytest tests -q',
      ].join('\n'),
    };

    const report = gateCheck({ files: replacing(PYTHON_FILES, gate), paths: [] });

    expect(check(report, 'format check reads tracked files')).toEqual({
      name: 'format check reads tracked files',
      passed: true,
    });
  });

  it('fails a Python gate whose pre-commit hook does not run it on push', () => {
    const config = {
      path: '.pre-commit-config.yaml',
      content: 'repos:\n  - repo: local\n    hooks:\n      - id: ruff\n        entry: ruff check\n',
    };

    const report = gateCheck({ files: replacing(PYTHON_FILES, config), paths: [] });

    expect(check(report, 'pre-push runs the gate')).toEqual({
      name: 'pre-push runs the gate',
      passed: false,
      reason: '.pre-commit-config.yaml has no pre-push hook whose entry is backend/gate.sh',
    });
  });

  it('fails the coverage check on a Python floor', () => {
    const workflow = {
      path: '.github/workflows/backend.yml',
      content: 'steps:\n  - run: ./gate.sh\n  - run: pytest --cov=src --cov-fail-under=50\n',
    };

    const report = gateCheck({ files: replacing(PYTHON_FILES, workflow), paths: [] });

    expect(check(report, 'coverage is never a gate')).toEqual({
      name: 'coverage is never a gate',
      passed: false,
      reason:
        '.github/workflows/backend.yml makes coverage a gate (--cov-fail-under); coverage is information (ADR 0012)',
    });
  });
});
