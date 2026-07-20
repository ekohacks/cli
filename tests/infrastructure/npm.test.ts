import { describe, expect, it } from 'vitest';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';

describe('NpmWrapper (nulled)', () => {
  it('answers the configured published version', async () => {
    const npm = NpmWrapper.createNull({ publishedVersions: { ekolite: '0.4.0' } });

    expect(await npm.publishedVersion('ekolite')).toBe('0.4.0');
  });
});
