import { expect, it } from 'vitest';
import type { ProcessRunner } from '../../src/infrastructure/process.ts';

// The behaviour every ProcessRunner must honour, real or null (observatory ADR 0023, rule
// three). The real runner runs the commands below through a shell; the null is handed, per
// test, exactly what the real one will answer, so the two can never quietly disagree.
export type Commands = Record<string, { exitCode: number }>;
export type MakeProcessRunner = (commands: Commands) => ProcessRunner;

const SUCCEEDS = 'node -e "process.exit(0)"';
const FAILS_WITH_3 = 'node -e "process.exit(3)"';
const MISSING = 'ekohacks-no-such-command-zqx';

export function processRunnerContract(make: MakeProcessRunner): void {
  it('answers exit code 0, and nothing else, for a command that succeeds', async () => {
    const runner = make({ [SUCCEEDS]: { exitCode: 0 } });

    expect(await runner.run(SUCCEEDS)).toEqual({ exitCode: 0 });
  });

  it('answers the exit code of a command that fails', async () => {
    const runner = make({ [FAILS_WITH_3]: { exitCode: 3 } });

    expect(await runner.run(FAILS_WITH_3)).toEqual({ exitCode: 3 });
  });

  it('answers 127 for a command the shell cannot find', async () => {
    const runner = make({ [MISSING]: { exitCode: 127 } });

    expect(await runner.run(MISSING)).toEqual({ exitCode: 127 });
  });
}
