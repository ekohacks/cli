import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type RunGit = (args: string[]) => Promise<string>;

// Wraps the local git surface the CLI needs. Real and null share every line above the
// bottom layer: create() shells out to git, createNull() answers from configured output,
// so the null behaves exactly like the real thing without running git.
export class GitWrapper {
  static create({ cwd = process.cwd() }: { cwd?: string } = {}): GitWrapper {
    return new GitWrapper(async (args) => {
      const { stdout } = await execFileAsync('git', args, { cwd });
      return stdout;
    });
  }

  static createNull({
    branch = 'main',
    dirty = false,
  }: { branch?: string; dirty?: boolean } = {}): GitWrapper {
    const outputs: Record<string, string> = {
      'rev-parse --abbrev-ref HEAD': `${branch}\n`,
      'status --porcelain': dirty ? ' M some-file.ts\n' : '',
    };
    return new GitWrapper((args) => Promise.resolve(outputs[args.join(' ')] ?? ''));
  }

  private constructor(private readonly runGit: RunGit) {}

  async currentBranch(): Promise<string> {
    return (await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  }

  async workingTreeClean(): Promise<boolean> {
    return (await this.runGit(['status', '--porcelain'])).trim() === '';
  }
}
