import { describe, expect, it } from 'vitest';
import { ProcessRunner } from '../../src/infrastructure/process.ts';
import { processRunnerContract } from './processContract.ts';

describe('ProcessRunner (nulled)', () => {
  processRunnerContract((commands) => ProcessRunner.createNull({ commands }));

  it('answers exit code 0 for a command nobody configured', async () => {
    const runner = ProcessRunner.createNull();

    expect(await runner.run('npm run test:package')).toEqual({ exitCode: 0 });
  });
});
