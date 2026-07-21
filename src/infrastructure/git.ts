import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type RunGit = (args: string[]) => Promise<string>;

export type GitAction =
  | { action: 'createBranch'; branch: string }
  | { action: 'commitAll'; message: string }
  | { action: 'push' };

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
    behindOrigin = false,
  }: { branch?: string; dirty?: boolean; behindOrigin?: boolean } = {}): GitWrapper {
    const outputs: Record<string, string> = {
      'rev-parse --abbrev-ref HEAD': `${branch}\n`,
      'status --porcelain': dirty ? ' M some-file.ts\n' : '',
      'rev-parse main': behindOrigin ? 'local\n' : 'shared\n',
      'rev-parse origin/main': 'shared\n',
    };
    return new GitWrapper((args) => Promise.resolve(outputs[args.join(' ')] ?? ''));
  }

  private readonly runGit: RunGit;

  private constructor(runGit: RunGit) {
    this.runGit = runGit;
  }

  async currentBranch(): Promise<string> {
    return (await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  }

  async workingTreeClean(): Promise<boolean> {
    return (await this.runGit(['status', '--porcelain'])).trim() === '';
  }

  async mainInSyncWithOrigin(): Promise<boolean> {
    await this.runGit(['fetch', 'origin', 'main']);
    const local = (await this.runGit(['rev-parse', 'main'])).trim();
    const remote = (await this.runGit(['rev-parse', 'origin/main'])).trim();
    return local === remote;
  }

  private readonly actionTrackers: GitAction[][] = [];

  trackActions(): { data: GitAction[] } {
    const tracker: GitAction[] = [];
    this.actionTrackers.push(tracker);
    return { data: tracker };
  }

  private record(action: GitAction): void {
    for (const tracker of this.actionTrackers) {
      tracker.push(action);
    }
  }

  async createBranch(branch: string): Promise<void> {
    await this.runGit(['switch', '-c', branch]);
    this.record({ action: 'createBranch', branch });
  }

  async commitAll(message: string): Promise<void> {
    await this.runGit(['commit', '--all', '--message', message]);
    this.record({ action: 'commitAll', message });
  }

  async push(): Promise<void> {
    await this.runGit(['push', '--set-upstream', 'origin', 'HEAD']);
    this.record({ action: 'push' });
  }
}
