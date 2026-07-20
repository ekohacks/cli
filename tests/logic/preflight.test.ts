import { describe, expect, it } from 'vitest';
import { preflight } from '../../src/logic/preflight.ts';

describe('preflight', () => {
  it('fails the changelog check when the version has no entry', async () => {
    const report = await preflight({ version: '0.5.0', changelog: '# Changelog\n' });

    expect(report.checks).toContainEqual({
      name: 'changelog entry',
      passed: false,
      reason: 'no ## 0.5.0 heading in the changelog',
    });
  });
});
