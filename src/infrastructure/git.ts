// Wraps the local git surface the CLI needs. The null answers from configured state and
// never runs git; the real side arrives with its own integration test.
export class GitWrapper {
  static createNull({ branch = 'main' }: { branch?: string } = {}): GitWrapper {
    return new GitWrapper(branch);
  }

  private constructor(private readonly branch: string) {}

  currentBranch(): Promise<string> {
    return Promise.resolve(this.branch);
  }
}
