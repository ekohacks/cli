import { expect, it } from 'vitest';
import type { NpmWrapper } from '../../src/infrastructure/npm.ts';

// The behaviour every NpmWrapper must honour, real or null (observatory ADR 0023, rule
// three). The real side asks the registry and bumps a throwaway package.json; the null is
// handed what the registry would say. A version the registry carries changes with every
// release, so the contract asks for its shape, not its value.
export interface NpmState {
  publishedVersions?: Record<string, string | string[]>;
}
export type MakeNpm = (state: NpmState) => Promise<NpmWrapper>;

const KNOWN = 'ekolite';
const UNKNOWN = 'ekohacks-surely-never-published-zqx';

export function npmContract(make: MakeNpm): void {
  it('answers the published version of a package the registry knows', async () => {
    const npm = await make({ publishedVersions: { [KNOWN]: '0.4.0' } });

    expect(await npm.publishedVersion(KNOWN)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('answers undefined for a package the registry does not know', async () => {
    const npm = await make({});

    expect(await npm.publishedVersion(UNKNOWN)).toBeUndefined();
  });

  it('bumps the version and records it', async () => {
    const npm = await make({});
    const bumps = npm.trackBumps();

    await npm.bumpVersion('0.5.0');

    expect(bumps.data).toEqual(['0.5.0']);
  });

  it('refuses a bump that is not a version, naming it, and records nothing', async () => {
    const npm = await make({});
    const bumps = npm.trackBumps();

    await expect(npm.bumpVersion('not-a-version')).rejects.toThrow(
      /npm version not-a-version failed/,
    );

    expect(bumps.data).toEqual([]);
  });
}
