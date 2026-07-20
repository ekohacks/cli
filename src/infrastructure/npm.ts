type PublishedVersions = Record<string, string>;

// Wraps the npm registry surface the CLI needs. The null answers from a configured map of
// package name to published version and never touches the network; the real side arrives
// with its own integration test.
export class NpmWrapper {
  static createNull({
    publishedVersions = {},
  }: { publishedVersions?: PublishedVersions } = {}): NpmWrapper {
    return new NpmWrapper(publishedVersions);
  }

  private constructor(private readonly versions: PublishedVersions) {}

  publishedVersion(pkg: string): Promise<string | undefined> {
    return Promise.resolve(this.versions[pkg]);
  }
}
