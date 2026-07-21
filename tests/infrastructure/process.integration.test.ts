import { describe, expect, it } from 'vitest';
import { ProcessRunner } from '../../src/infrastructure/process.ts';

describe('ProcessRunner (integration)', () => {
  it('answers the exit code of a real command', async () => {
    const runner = ProcessRunner.create();

    expect(await runner.run('node -e "process.exit(3)"')).toEqual({ exitCode: 3 });
    expect(await runner.run('node -e "process.exit(0)"')).toEqual({ exitCode: 0 });
  });
});
