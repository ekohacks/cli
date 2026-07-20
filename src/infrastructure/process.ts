type CommandResults = Record<string, { exitCode: number }>;

// Wraps the child processes the CLI shells out to. The null answers configured exit codes
// per command, exit 0 when unconfigured, and never spawns anything; the real side arrives
// with its own integration test.
export class ProcessRunner {
  static createNull({ commands = {} }: { commands?: CommandResults } = {}): ProcessRunner {
    return new ProcessRunner(commands);
  }

  private constructor(private readonly commands: CommandResults) {}

  run(command: string): Promise<{ exitCode: number }> {
    return Promise.resolve(this.commands[command] ?? { exitCode: 0 });
  }
}
