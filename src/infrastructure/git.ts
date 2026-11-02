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

  // The null is a repository in a given state, and it keeps that state the way a repository
  // would: a created branch becomes the current one and exists, a commit cleans the tree. It
  // cannot see a file npm or the shell wrote, so it never refuses a commit for having nothing
  // to commit; that is the real side's own test.
  static createNull({
    branch = 'main',
    dirty = false,
    behindOrigin = false,
    existingBranches = [],
    versionOnMain = '0.0.0',
  }: {
    branch?: string;
    dirty?: boolean;
    behindOrigin?: boolean;
    existingBranches?: string[];
    versionOnMain?: string;
  } = {}): GitWrapper {
    const state = { branch, dirty, branches: new Set(['main', branch, ...existingBranches]) };
    return new GitWrapper((args) => {
      const [command, ...rest] = args;
      if (command === 'rev-parse' && rest[0] === '--abbrev-ref') {
        return Promise.resolve(`${state.branch}\n`);
      }
      if (command === 'rev-parse') {
        return Promise.resolve(rest[0] === 'main' && behindOrigin ? 'local\n' : 'shared\n');
      }
      if (command === 'status') {
        return Promise.resolve(state.dirty ? ' M some-file.ts\n' : '');
      }
      if (command === 'branch') {
        const name = rest[1] ?? '';
        return Promise.resolve(state.branches.has(name) ? `  ${name}\n` : '');
      }
      if (command === 'show') {
        return Promise.resolve(`${JSON.stringify({ version: versionOnMain })}\n`);
      }
      if (command === 'switch') {
        state.branch = rest[1] ?? state.branch;
        state.branches.add(state.branch);
        return Promise.resolve('');
      }
      if (command === 'commit') {
        state.dirty = false;
        return Promise.resolve('');
      }
      return Promise.resolve('');
    });
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

  // git branch --list exits 0 whether or not the branch exists, so this never trips the
  // real runner's throw-on-nonzero; existence is in the output.
  async branchExists(branch: string): Promise<boolean> {
    return (await this.runGit(['branch', '--list', branch])).trim() !== '';
  }

  // The version main carries on origin, not in this checkout: the Release targets
  // GitHub's main, so a stale local package.json must not answer for it.
  async versionOnMain(): Promise<string | undefined> {
    await this.runGit(['fetch', 'origin', 'main']);
    const manifest = await this.runGit(['show', 'origin/main:package.json']);
    return (JSON.parse(manifest) as { version?: string }).version;
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
