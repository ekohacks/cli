import { describe, expect, it } from 'vitest';
import { ProcessRunner } from '../../src/infrastructure/process.ts';

describe('ProcessRunner (nulled)', () => {
  it('answers the configured exit code for a command', async () => {
    const runner = ProcessRunner.createNull({
      commands: { 'npm run test:package': { exitCode: 1 } },
    });

    expect(await runner.run('npm run test:package')).toEqual({ exitCode: 1 });
  });
});
