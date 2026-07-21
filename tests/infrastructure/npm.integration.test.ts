import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('NpmWrapper (integration)', () => {
  it('answers the published version of a real package', async () => {
    const npm = NpmWrapper.create();

    expect(await npm.publishedVersion('ekolite')).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('answers undefined for a package the registry does not know', async () => {
    const npm = NpmWrapper.create();

    expect(await npm.publishedVersion('ekohacks-surely-never-published-zqx')).toBeUndefined();
  });

  it('bumps the version of a real package.json', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ekohacks-npm-'));
    dirs.push(dir);
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'throwaway', version: '0.4.0' }),
    );

    const npm = NpmWrapper.create({ cwd: dir });
    await npm.bumpVersion('0.5.0');

    const bumped = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(bumped.version).toBe('0.5.0');
  });
});
