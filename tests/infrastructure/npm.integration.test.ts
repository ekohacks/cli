import { describe, expect, it } from 'vitest';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';

describe('NpmWrapper (integration)', () => {
  it('answers the published version of a real package', async () => {
    const npm = NpmWrapper.create();

    expect(await npm.publishedVersion('ekolite')).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('answers undefined for a package the registry does not know', async () => {
    const npm = NpmWrapper.create();

    expect(await npm.publishedVersion('ekohacks-surely-never-published-zqx')).toBeUndefined();
  });
});
