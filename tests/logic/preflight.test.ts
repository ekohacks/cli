import { describe, expect, it } from 'vitest';
import { GitWrapper } from '../../src/infrastructure/git.ts';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';
import { preflight } from '../../src/logic/preflight.ts';

const CHANGELOG = ['# Changelog', '', '## 0.5.0', '', '- **A thing.** (#160)', ''].join('\n');

const runPreflight = ({
  version = '0.5.0',
  changelog = CHANGELOG,
  npm = NpmWrapper.createNull(),
  pkg = 'ekolite',
  git = GitWrapper.createNull(),
} = {}) => preflight({ version, changelog, npm, pkg, git });

describe('preflight', () => {
  it('fails the changelog check when the version has no entry', async () => {
    const report = await runPreflight({ changelog: '# Changelog\n' });

    expect(report.checks).toContainEqual({
      name: 'changelog entry',
      passed: false,
      reason: 'no ## 0.5.0 heading in the changelog',
    });
  });

  it('fails the version check when the version is already published', async () => {
    const npm = NpmWrapper.createNull({ publishedVersions: { ekolite: '0.5.0' } });

    const report = await runPreflight({ npm });

    expect(report.checks).toContainEqual({
      name: 'version is new',
      passed: false,
      reason: '0.5.0 is already published',
    });
  });

  it('fails the branch check when not on main', async () => {
    const git = GitWrapper.createNull({ branch: 'feature/thing' });

    const report = await runPreflight({ git });

    expect(report.checks).toContainEqual({
      name: 'on main',
      passed: false,
      reason: 'on feature/thing, not main',
    });
  });
});
