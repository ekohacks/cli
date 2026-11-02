import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NpmWrapper } from '../../src/infrastructure/npm.ts';
import { npmContract } from './npmContract.ts';

const dirs: string[] = [];

// A throwaway package for the real npm to bump; the registry answers for itself.
const throwawayPackage = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ekohacks-npm-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'throwaway', version: '0.4.0' }));
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('NpmWrapper (integration)', () => {
  npmContract(() => Promise.resolve(NpmWrapper.create({ cwd: throwawayPackage() })));

  it('writes the bumped version into the real package.json', async () => {
    const dir = throwawayPackage();

    await NpmWrapper.create({ cwd: dir }).bumpVersion('0.5.0');

    const bumped = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      version: string;
    };
    expect(bumped.version).toBe('0.5.0');
  });
});
