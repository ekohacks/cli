import { describe, expect, it } from 'vitest';
import { ProcessRunner } from '../../src/infrastructure/process.ts';
import { ClaudeWrapper } from '../../src/infrastructure/claude.ts';
import { GhWrapper } from '../../src/infrastructure/gh.ts';
import { GitWrapper } from '../../src/infrastructure/git.ts';
import {
  docsCheck,
  docsDraft,
  docsSync,
  draftBranchConflict,
  draftPrompts,
  openDraftPr,
} from '../../src/logic/docs.ts';

const EXPORTS = {
  '.': { import: './dist/server/index.js' },
  './react': { import: './dist/client/react.js' },
};

const README = [
  'Two entry points, everything else stays internal:',
  '',
  '<!-- ekohacks:entry-points -->',
  '```ts',
  "import { App } from 'ekolite';",
  "import { useSubscription } from 'ekolite/react';",
  '```',
  '<!-- /ekohacks:entry-points -->',
  '',
].join('\n');

const blockWith = (...imports: string[]) =>
  [
    '<!-- ekohacks:entry-points -->',
    ...imports.map((specifier) => `import thing from '${specifier}';`),
    '<!-- /ekohacks:entry-points -->',
    '',
  ].join('\n');

const runDocsCheck = ({
  pkg = 'ekolite',
  exports = EXPORTS as unknown,
  files = [{ path: 'README.md', content: README }],
  runner = ProcessRunner.createNull(),
} = {}) => docsCheck({ pkg, exports, files, runner });

describe('docs check', () => {
  it('fails when no docs file carries the entry-points block', async () => {
    const report = await runDocsCheck({ files: [{ path: 'README.md', content: '# ekolite\n' }] });

    expect(report.checks).toContainEqual({
      name: 'entry points declared',
      passed: false,
      reason: 'no docs file carries an <!-- ekohacks:entry-points --> block',
    });
  });

  it('fails the file check when a public entry point is not listed', async () => {
    const exports = { ...EXPORTS, './config': { import: './dist/server/config.js' } };

    const report = await runDocsCheck({ exports });

    expect(report.checks).toContainEqual({
      name: 'entry points in README.md',
      passed: false,
      reason: 'not listed: ekolite/config',
    });
  });

  it('fails the file check when the docs list an entry point gone from the exports', async () => {
    const files = [
      { path: 'README.md', content: blockWith('ekolite', 'ekolite/react', 'ekolite/legacy') },
    ];

    const report = await runDocsCheck({ files });

    expect(report.checks).toContainEqual({
      name: 'entry points in README.md',
      passed: false,
      reason: 'not in exports: ekolite/legacy',
    });
  });

  it('checks every file that carries a block, each under its own name', async () => {
    const files = [
      { path: 'README.md', content: README },
      { path: 'docs/quick-start.md', content: blockWith('ekolite') },
    ];

    const report = await runDocsCheck({ files });

    expect(report.checks).toContainEqual({ name: 'entry points in README.md', passed: true });
    expect(report.checks).toContainEqual({
      name: 'entry points in docs/quick-start.md',
      passed: false,
      reason: 'not listed: ekolite/react',
    });
  });

  it('ignores imports of other packages inside the block', async () => {
    const files = [{ path: 'README.md', content: blockWith('react', 'ekolite', 'ekolite/react') }];

    const report = await runDocsCheck({ files });

    expect(report.checks).toContainEqual({ name: 'entry points in README.md', passed: true });
  });

  it('treats a package without an exports map as its own single entry point', async () => {
    const files = [{ path: 'README.md', content: blockWith('ekolite') }];

    // Not through the helper: its default parameter would swallow an explicit undefined.
    const report = await docsCheck({
      pkg: 'ekolite',
      exports: undefined,
      files,
      runner: ProcessRunner.createNull(),
    });

    expect(report.checks).toContainEqual({ name: 'entry points in README.md', passed: true });
  });

  it('treats a conditions-only exports map as its own single entry point', async () => {
    const files = [{ path: 'README.md', content: blockWith('ekolite') }];

    const report = await runDocsCheck({ exports: { import: './dist/index.js' }, files });

    expect(report.checks).toContainEqual({ name: 'entry points in README.md', passed: true });
  });

  it('does not count the package.json key in the exports map as an entry point', async () => {
    const exports = { ...EXPORTS, './package.json': './package.json' };

    const report = await runDocsCheck({ exports });

    expect(report.checks).toContainEqual({ name: 'entry points in README.md', passed: true });
  });

  it('does not count pattern keys in the exports map as entry points', async () => {
    const exports = { ...EXPORTS, './locales/*': './dist/locales/*.js' };

    const report = await runDocsCheck({ exports });

    expect(report.checks).toContainEqual({ name: 'entry points in README.md', passed: true });
  });

  it('fails an unclosed block instead of guessing where it ends', async () => {
    const files = [
      { path: 'README.md', content: "<!-- ekohacks:entry-points -->\nimport 'ekolite';\n" },
    ];

    const report = await runDocsCheck({ files });

    expect(report.checks).toContainEqual({
      name: 'entry points in README.md',
      passed: false,
      reason: 'unclosed ekohacks:entry-points block',
    });
  });

  it('fails the count check when the prose claims the wrong number of entry points', async () => {
    const files = [
      {
        path: 'docs/quick-start.md',
        content: `Four entry points:\n\n${blockWith('ekolite', 'ekolite/react')}`,
      },
    ];

    const report = await runDocsCheck({ files });

    expect(report.checks).toContainEqual({
      name: 'entry count in docs/quick-start.md',
      passed: false,
      reason: 'claims 4 entry points, exports has 2',
    });
  });

  it('passes every check when the docs match the exports', async () => {
    const report = await runDocsCheck();

    expect(report.checks).toContainEqual({ name: 'entry points in README.md', passed: true });
    expect(report.checks).toContainEqual({ name: 'entry count in README.md', passed: true });
    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it('never scans files under .vitepress', async () => {
    const files = [
      { path: 'README.md', content: README },
      { path: 'docs/.vitepress/dist/index.md', content: 'Nine entry points.' },
    ];

    const report = await runDocsCheck({ files });

    expect(report.checks.every((check) => check.passed)).toBe(true);
  });

  it('fails the build check when the docs build fails', async () => {
    const runner = ProcessRunner.createNull({
      commands: { 'npm run docs:build': { exitCode: 1 } },
    });

    const report = await runDocsCheck({ runner });

    expect(report.checks).toContainEqual({
      name: 'docs build',
      passed: false,
      reason: 'npm run docs:build failed',
    });
  });
});

const runDocsSync = ({
  pkg = 'ekolite',
  exports = EXPORTS as unknown,
  files = [{ path: 'README.md', content: README }],
} = {}) => docsSync({ pkg, exports, files });

describe('docs sync', () => {
  it('returns no edits when the docs already match the exports', () => {
    const result = runDocsSync();

    expect(result.edits).toEqual([]);
  });

  it('never edits a file under .vitepress', () => {
    const exports = { ...EXPORTS, './config': { import: './dist/server/config.js' } };
    const files = [{ path: 'docs/.vitepress/dist/quick-start.md', content: blockWith('ekolite') }];

    const result = runDocsSync({ exports, files });

    expect(result.edits).toEqual([]);
  });

  it('leaves an unclosed block alone instead of guessing where it ends', () => {
    const exports = { ...EXPORTS, './config': { import: './dist/server/config.js' } };
    const content = "<!-- ekohacks:entry-points -->\nimport thing from 'ekolite';\n";

    const result = runDocsSync({ exports, files: [{ path: 'README.md', content }] });

    expect(result.edits).toEqual([]);
  });

  it('adds an entry point the exports declare and the block does not list', () => {
    const exports = { ...EXPORTS, './config': { import: './dist/server/config.js' } };
    const files = [{ path: 'README.md', content: blockWith('ekolite', 'ekolite/react') }];

    const result = runDocsSync({ exports, files });

    // The block edit is this test's subject; a new entry point also scaffolds a stub page, and
    // asserting the whole result here would make this test a second, weaker spec for that.
    expect(result.edits).toContainEqual({
      path: 'README.md',
      content: [
        '<!-- ekohacks:entry-points -->',
        "import thing from 'ekolite';",
        "import thing from 'ekolite/react';",
        "import * as config from 'ekolite/config';",
        '<!-- /ekohacks:entry-points -->',
        '',
      ].join('\n'),
    });
  });

  it('removes an entry point gone from the exports and leaves other packages alone', () => {
    const files = [
      {
        path: 'README.md',
        content: blockWith('react', 'ekolite', 'ekolite/legacy', 'ekolite/react'),
      },
    ];

    const result = runDocsSync({ files });

    expect(result.edits).toEqual([
      { path: 'README.md', content: blockWith('react', 'ekolite', 'ekolite/react') },
    ]);
  });

  it('rewrites a word count as a word, keeping the case it was written in', () => {
    const inStep = blockWith('ekolite', 'ekolite/react');
    const files = [{ path: 'docs/quick-start.md', content: `Four entry points:\n\n${inStep}` }];

    const result = runDocsSync({ files });

    expect(result.edits).toEqual([
      { path: 'docs/quick-start.md', content: `Two entry points:\n\n${inStep}` },
    ]);
  });

  it('rewrites a digit count as a digit, and every claim in the file', () => {
    const inStep = blockWith('ekolite', 'ekolite/react');
    const content = `5 entry points:\n\nAll five entry points ship today.\n\n${inStep}`;

    const result = runDocsSync({ files: [{ path: 'docs/quick-start.md', content }] });

    expect(result.edits).toEqual([
      {
        path: 'docs/quick-start.md',
        content: `2 entry points:\n\nAll two entry points ship today.\n\n${inStep}`,
      },
    ]);
  });

  it('writes a stub page for a new entry point, and none for the package itself', () => {
    const exports = { ...EXPORTS, './config': { import: './dist/server/config.js' } };
    const files = [{ path: 'README.md', content: blockWith('ekolite', 'ekolite/react') }];

    const result = runDocsSync({ exports, files });

    expect(result.edits).toEqual([
      {
        path: 'README.md',
        content: [
          '<!-- ekohacks:entry-points -->',
          "import thing from 'ekolite';",
          "import thing from 'ekolite/react';",
          "import * as config from 'ekolite/config';",
          '<!-- /ekohacks:entry-points -->',
          '',
        ].join('\n'),
      },
      {
        path: 'docs/config.md',
        content: [
          '# ekolite/config',
          '',
          '<!-- ekohacks:draft -->',
          '',
          '```ts',
          "import * as config from 'ekolite/config';",
          '',
          '// TODO: an example that runs.',
          '```',
          '',
          '## What works today',
          '',
          '- TODO: what a reader can rely on today, not what is planned.',
          '',
          '<!-- /ekohacks:draft -->',
          '',
          '<!-- TODO: add this page to the sidebar in docs/.vitepress/config.mts:',
          "     { text: 'config', link: '/config' } -->",
          '',
        ].join('\n'),
      },
    ]);
  });

  it('never overwrites a page that already exists', () => {
    const exports = { ...EXPORTS, './config': { import: './dist/server/config.js' } };
    const files = [
      { path: 'README.md', content: blockWith('ekolite', 'ekolite/react') },
      { path: 'docs/config.md', content: '# Configuring ekolite\n\nSomebody wrote this.\n' },
    ];

    const result = runDocsSync({ exports, files });

    expect(result.edits.map((edit) => edit.path)).toEqual(['README.md']);
  });

  it('writes a count above ten as a digit, having no word for it', () => {
    const many = Array.from({ length: 11 }, (_, index) =>
      index === 0 ? 'ekolite' : `ekolite/m${index}`,
    );
    const exports = Object.fromEntries(
      many.map((_, index) => [index === 0 ? '.' : `./m${index}`, './dist/m.js']),
    );
    const inStep = blockWith(...many);
    const files = [{ path: 'docs/quick-start.md', content: `Four entry points:\n\n${inStep}` }];

    const result = runDocsSync({ exports, files });

    expect(result.edits).toEqual([
      { path: 'docs/quick-start.md', content: `11 entry points:\n\n${inStep}` },
    ]);
  });
});

const draftStub = (specifier: string) =>
  [
    `# ${specifier}`,
    '',
    '<!-- ekohacks:draft -->',
    '',
    '```ts',
    `import * as thing from '${specifier}';`,
    '```',
    '',
    '<!-- /ekohacks:draft -->',
    '',
  ].join('\n');

describe('docs draft', () => {
  const exports = { ...EXPORTS, './config': { import: './dist/server/config.js' } };
  const overview = {
    path: 'docs/overview.md',
    content: '# Overview\n\nEkoLite is a real time backend.\n',
  };
  const quickStart = {
    path: 'docs/quick-start.md',
    content: '# Quick start\n\nInstall it and go.\n',
  };
  const stub = { path: 'docs/config.md', content: draftStub('ekolite/config') };

  it('builds one prompt per page carrying a draft block', () => {
    const prompts = draftPrompts({ pkg: 'ekolite', exports, files: [overview, quickStart, stub] });

    expect(prompts.map((prompt) => ({ specifier: prompt.specifier, path: prompt.path }))).toEqual([
      { specifier: 'ekolite/config', path: 'docs/config.md' },
    ]);
  });

  it('carries the entry point, its exports entry, the stub, and two docs pages as the voice sample', () => {
    const [prompt] = draftPrompts({
      pkg: 'ekolite',
      exports,
      files: [overview, quickStart, stub],
    });

    expect(prompt?.prompt).toContain('ekolite/config');
    expect(prompt?.prompt).toContain('./dist/server/config.js');
    expect(prompt?.prompt).toContain(stub.content);
    expect(prompt?.prompt).toContain('EkoLite is a real time backend.');
    expect(prompt?.prompt).toContain('Install it and go.');
  });

  it('lands the drafted prose inside the block and leaves the rest of the page', async () => {
    const claude = ClaudeWrapper.createNull({ responses: ['## Example\n\nrun it.'] });

    const result = await docsDraft({
      pkg: 'ekolite',
      exports,
      files: [overview, quickStart, stub],
      claude,
    });

    expect(result.edits).toEqual([
      {
        path: 'docs/config.md',
        content: [
          '# ekolite/config',
          '',
          '<!-- ekohacks:draft -->',
          '',
          '## Example',
          '',
          'run it.',
          '',
          '<!-- /ekohacks:draft -->',
          '',
        ].join('\n'),
      },
    ]);
  });

  it('never drafts a page that carries no draft block', async () => {
    const claude = ClaudeWrapper.createNull({ responses: ['ignored'] });

    const result = await docsDraft({
      pkg: 'ekolite',
      exports,
      files: [overview, quickStart],
      claude,
    });

    expect(result.edits).toEqual([]);
  });

  it('branches, commits, pushes, and opens a PR naming each drafted entry point', async () => {
    const git = GitWrapper.createNull();
    const gh = GhWrapper.createNull({ prNumber: 42 });
    const actions = git.trackActions();
    const opens = gh.trackOpens();

    const result = await openDraftPr({
      specifiers: ['ekolite/config', 'ekolite/testing'],
      git,
      gh,
    });

    if ('stopped' in result) {
      throw new Error(`unexpected stop: ${result.stopped}`);
    }
    expect(result.number).toBe(42);
    expect(actions.data.map((action) => action.action)).toEqual([
      'createBranch',
      'commitAll',
      'push',
    ]);
    const [open] = opens.data;
    expect(open?.body).toContain('ekolite/config');
    expect(open?.body).toContain('ekolite/testing');
    expect(open?.body.toLowerCase()).toContain('machine-drafted');
  });

  it('stops when the draft branch already exists, touching nothing', async () => {
    const git = GitWrapper.createNull({ existingBranches: ['docs/draft'] });
    const gh = GhWrapper.createNull();
    const actions = git.trackActions();
    const opens = gh.trackOpens();

    const result = await openDraftPr({ specifiers: ['ekolite/config'], git, gh });

    expect(result).toEqual({ stopped: 'branch docs/draft already exists from an earlier draft' });
    expect(actions.data).toEqual([]);
    expect(opens.data).toEqual([]);
  });

  it('names the branch conflict when it is taken and is silent when it is free', async () => {
    const free = GitWrapper.createNull();
    const taken = GitWrapper.createNull({ existingBranches: ['docs/draft'] });

    expect(await draftBranchConflict(free)).toBeUndefined();
    expect(await draftBranchConflict(taken)).toBe(
      'branch docs/draft already exists from an earlier draft',
    );
  });
});
