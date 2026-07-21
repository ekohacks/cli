import { execFile } from 'node:child_process';

type OpenPrOptions = { title: string; body: string };
type CreateReleaseOptions = { tag: string; title: string; notes: string };

export interface PrCheck {
  name: string;
  concluded: boolean;
  passed: boolean;
}

type GhResult = { exitCode: number; stdout: string; stderr: string };
type RunGh = (args: string[]) => Promise<GhResult>;

type CheckRow = { name: string; bucket: string };

const bucketFor = (check: PrCheck): string =>
  !check.concluded ? 'pending' : check.passed ? 'pass' : 'fail';

// Wraps the GitHub surface the CLI needs, behind the gh cli. Real and null share every
// line above the bottom layer: create() shells out to gh, createNull() answers gh-shaped
// output from configured state and never talks to GitHub; the real side is proven by a
// real release rather than a faked GitHub. checkRounds configures successive answers to
// checks(): each call takes the next round, and the last round repeats, so a test can
// walk a PR from pending to concluded.
export class GhWrapper {
  static create({ cwd = process.cwd() }: { cwd?: string } = {}): GhWrapper {
    return new GhWrapper(
      (args) =>
        new Promise((resolve) => {
          execFile('gh', args, { cwd }, (error, stdout, stderr) => {
            const exitCode = error === null ? 0 : 1;
            resolve({ exitCode, stdout, stderr });
          });
        }),
    );
  }

  static createNull({
    prNumber = 1,
    checkRounds = [[]],
  }: { prNumber?: number; checkRounds?: PrCheck[][] } = {}): GhWrapper {
    let round = 0;
    return new GhWrapper((args) => {
      if (args[0] === 'pr' && args[1] === 'create') {
        return Promise.resolve({
          exitCode: 0,
          stdout: `https://github.com/nulled/nulled/pull/${prNumber}\n`,
          stderr: '',
        });
      }
      if (args[0] === 'pr' && args[1] === 'checks') {
        const index = Math.min(round, checkRounds.length - 1);
        round += 1;
        const rows: CheckRow[] = (checkRounds[index] ?? []).map((check) => ({
          name: check.name,
          bucket: bucketFor(check),
        }));
        return Promise.resolve({ exitCode: 0, stdout: `${JSON.stringify(rows)}\n`, stderr: '' });
      }
      return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
    });
  }

  private readonly runGh: RunGh;

  private constructor(runGh: RunGh) {
    this.runGh = runGh;
  }

  private readonly openTrackers: OpenPrOptions[][] = [];

  trackOpens(): { data: OpenPrOptions[] } {
    const tracker: OpenPrOptions[] = [];
    this.openTrackers.push(tracker);
    return { data: tracker };
  }

  async openPr(options: OpenPrOptions): Promise<{ number: number }> {
    const result = await this.runGh([
      'pr',
      'create',
      '--title',
      options.title,
      '--body',
      options.body,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`gh pr create failed:\n${result.stderr}`);
    }
    const url = result.stdout.match(/\/pull\/(\d+)/);
    if (url === null) {
      throw new Error(`gh pr create answered no pr url:\n${result.stdout}`);
    }
    for (const tracker of this.openTrackers) {
      tracker.push(options);
    }
    return { number: Number(url[1]) };
  }

  // gh pr checks exits non-zero while checks are pending or failing, so the answer is in
  // stdout, not the exit code.
  async checks(prNumber: number): Promise<PrCheck[]> {
    const result = await this.runGh(['pr', 'checks', String(prNumber), '--json', 'name,bucket']);
    if (result.stdout.trim() === '') {
      if (result.exitCode !== 0) {
        throw new Error(`gh pr checks ${prNumber} failed:\n${result.stderr}`);
      }
      return [];
    }
    const rows = JSON.parse(result.stdout) as CheckRow[];
    return rows.map((row) => ({
      name: row.name,
      concluded: row.bucket !== 'pending',
      passed: row.bucket === 'pass' || row.bucket === 'skipping',
    }));
  }

  private readonly releaseTrackers: CreateReleaseOptions[][] = [];

  trackReleases(): { data: CreateReleaseOptions[] } {
    const tracker: CreateReleaseOptions[] = [];
    this.releaseTrackers.push(tracker);
    return { data: tracker };
  }

  async createRelease(options: CreateReleaseOptions): Promise<void> {
    const result = await this.runGh([
      'release',
      'create',
      options.tag,
      '--target',
      'main',
      '--title',
      options.title,
      '--notes',
      options.notes,
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`gh release create ${options.tag} failed:\n${result.stderr}`);
    }
    for (const tracker of this.releaseTrackers) {
      tracker.push(options);
    }
  }

  private readonly mergeTrackers: number[][] = [];

  trackMerges(): { data: number[] } {
    const tracker: number[] = [];
    this.mergeTrackers.push(tracker);
    return { data: tracker };
  }

  async mergePr(prNumber: number): Promise<void> {
    const result = await this.runGh(['pr', 'merge', String(prNumber), '--squash']);
    if (result.exitCode !== 0) {
      throw new Error(`gh pr merge ${prNumber} failed:\n${result.stderr}`);
    }
    for (const tracker of this.mergeTrackers) {
      tracker.push(prNumber);
    }
  }
}
