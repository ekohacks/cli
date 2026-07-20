// Wraps the local git surface the CLI needs. The null answers from configured state and
// never runs git; the real side arrives with its own integration test.
export class GitWrapper {
  static createNull({
    branch = 'main',
    dirty = false,
  }: { branch?: string; dirty?: boolean } = {}): GitWrapper {
    return new GitWrapper(branch, dirty);
  }

  private constructor(
    private readonly branch: string,
    private readonly dirty: boolean,
  ) {}

  currentBranch(): Promise<string> {
    return Promise.resolve(this.branch);
  }

  workingTreeClean(): Promise<boolean> {
    return Promise.resolve(!this.dirty);
  }
}
