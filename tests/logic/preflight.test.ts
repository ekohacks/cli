import { describe, expect, it } from 'vitest';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';
import { preflight } from '../../src/logic/preflight.ts';

const CHANGELOG = ['# Changelog', '', '## 0.5.0', '', '- **A thing.** (#160)', ''].join('\n');

describe('preflight', () => {
  it('fails the changelog check when the version has no entry', async () => {
    const report = await preflight({
      version: '0.5.0',
      changelog: '# Changelog\n',
      npm: NpmWrapper.createNull(),
      pkg: 'ekolite',
    });

    expect(report.checks).toContainEqual({
      name: 'changelog entry',
      passed: false,
      reason: 'no ## 0.5.0 heading in the changelog',
    });
  });

  it('fails the version check when the version is already published', async () => {
    const npm = NpmWrapper.createNull({ publishedVersions: { ekolite: '0.5.0' } });

    const report = await preflight({ version: '0.5.0', changelog: CHANGELOG, npm, pkg: 'ekolite' });

    expect(report.checks).toContainEqual({
      name: 'version is new',
      passed: false,
      reason: '0.5.0 is already published',
    });
  });
});
