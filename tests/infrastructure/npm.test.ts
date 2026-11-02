import { describe, expect, it } from 'vitest';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';
import { npmContract } from './npmContract.ts';

describe('NpmWrapper (nulled)', () => {
  npmContract((state) => Promise.resolve(NpmWrapper.createNull(state)));

  it('answers published version rounds in order, repeating the last', async () => {
    const npm = NpmWrapper.createNull({ publishedVersions: { ekolite: ['0.4.0', '0.5.0'] } });

    expect(await npm.publishedVersion('ekolite')).toBe('0.4.0');
    expect(await npm.publishedVersion('ekolite')).toBe('0.5.0');
    expect(await npm.publishedVersion('ekolite')).toBe('0.5.0');
  });
});
