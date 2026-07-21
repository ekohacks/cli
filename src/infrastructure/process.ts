import { exec } from 'node:child_process';

type CommandResult = { exitCode: number };
type CommandResults = Record<string, CommandResult>;
type RunCommand = (command: string) => Promise<CommandResult>;

// Wraps the child processes the CLI shells out to. create() runs the command through a
// real shell and answers its exit code; the null answers configured exit codes per
// command, exit 0 when unconfigured, and never spawns anything.
export class ProcessRunner {
  static create({ cwd = process.cwd() }: { cwd?: string } = {}): ProcessRunner {
    return new ProcessRunner(
      (command) =>
        new Promise((resolve) => {
          const child = exec(command, { cwd });
          child.on('error', () => resolve({ exitCode: 1 }));
          child.on('exit', (code) => resolve({ exitCode: code ?? 1 }));
        }),
    );
  }

  static createNull({ commands = {} }: { commands?: CommandResults } = {}): ProcessRunner {
    return new ProcessRunner((command) => Promise.resolve(commands[command] ?? { exitCode: 0 }));
  }

  private constructor(private readonly runCommand: RunCommand) {}

  run(command: string): Promise<CommandResult> {
    return this.runCommand(command);
  }
}
