import { describe, expect, it } from 'vitest';
import { ProcessRunner } from '../../src/infrastructure/process.ts';
import { docsCheck } from '../../src/logic/docs.ts';

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
});
