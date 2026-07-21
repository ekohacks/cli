import { describe, expect, it } from 'vitest';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';

describe('NpmWrapper (nulled)', () => {
  it('answers the configured published version', async () => {
    const npm = NpmWrapper.createNull({ publishedVersions: { ekolite: '0.4.0' } });

    expect(await npm.publishedVersion('ekolite')).toBe('0.4.0');
  });

  it('records version bumps on its output tracker', async () => {
    const npm = NpmWrapper.createNull();
    const bumps = npm.trackBumps();

    await npm.bumpVersion('0.5.0');

    expect(bumps.data).toEqual(['0.5.0']);
  });
});
