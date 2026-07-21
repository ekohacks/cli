import { execFile } from 'node:child_process';

type NpmResult = { exitCode: number; stdout: string; stderr: string };
type RunNpm = (args: string[]) => Promise<NpmResult>;
type PublishedVersions = Record<string, string>;

// Wraps the npm registry surface the CLI needs. Real and null share every line above the
// bottom layer: create() shells out to npm, createNull() answers from a configured map of
// package name to published version, so the null never touches the network.
export class NpmWrapper {
  static create(): NpmWrapper {
    return new NpmWrapper(
      (args) =>
        new Promise((resolve) => {
          execFile('npm', args, (error, stdout, stderr) => {
            const exitCode = error === null ? 0 : 1;
            resolve({ exitCode, stdout, stderr });
          });
        }),
    );
  }

  static createNull({
    publishedVersions = {},
  }: { publishedVersions?: PublishedVersions } = {}): NpmWrapper {
    return new NpmWrapper((args) => {
      const pkg = args[1] ?? '';
      const version = publishedVersions[pkg];
      return Promise.resolve(
        version === undefined
          ? { exitCode: 1, stdout: '', stderr: `npm error code E404 ${pkg}` }
          : { exitCode: 0, stdout: `${version}\n`, stderr: '' },
      );
    });
  }

  private constructor(private readonly runNpm: RunNpm) {}

  async publishedVersion(pkg: string): Promise<string | undefined> {
    const result = await this.runNpm(['view', pkg, 'version']);
    if (result.exitCode === 0) {
      return result.stdout.trim();
    }
    if (result.stderr.includes('E404')) {
      return undefined;
    }
    throw new Error(`npm view ${pkg} failed:\n${result.stderr}`);
  }
}
