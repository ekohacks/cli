import { execFile } from 'node:child_process';

type OpenPrOptions = { title: string; body: string };
type CreateReleaseOptions = { tag: string; title: string; notes: string };

export interface PrCheck {
  name: string;
  concluded: boolean;
  passed: boolean;
}

export interface RunState {
  concluded: boolean;
  passed: boolean;
  url: string;
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
    waitingRun,
    runRounds = [{ concluded: true, passed: true, url: 'https://github.com/nulled/nulled' }],
  }: {
    prNumber?: number;
    checkRounds?: PrCheck[][];
    waitingRun?: number;
    runRounds?: RunState[];
  } = {}): GhWrapper {
    let round = 0;
    let runRound = 0;
    return new GhWrapper((args) => {
      if (args[0] === 'run' && args[1] === 'view') {
        const index = Math.min(runRound, runRounds.length - 1);
        runRound += 1;
        const state = runRounds[index] ?? { concluded: true, passed: true, url: '' };
        const row = {
          status: state.concluded ? 'completed' : 'in_progress',
          conclusion: !state.concluded ? '' : state.passed ? 'success' : 'failure',
          url: state.url,
        };
        return Promise.resolve({ exitCode: 0, stdout: `${JSON.stringify(row)}\n`, stderr: '' });
      }
      if (args[0] === 'run' && args[1] === 'list') {
        const rows = waitingRun === undefined ? [] : [{ databaseId: waitingRun }];
        return Promise.resolve({ exitCode: 0, stdout: `${JSON.stringify(rows)}\n`, stderr: '' });
      }
      if (args[0] === 'api' && args[1]?.endsWith('pending_deployments') === true) {
        const rows = [{ environment: { id: 1, name: 'release' } }];
        return Promise.resolve({ exitCode: 0, stdout: `${JSON.stringify(rows)}\n`, stderr: '' });
      }
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

  async waitingRun(workflow: string): Promise<{ id: number } | undefined> {
    const result = await this.runGh([
      'run',
      'list',
      '--workflow',
      workflow,
      '--status',
      'waiting',
      '--json',
      'databaseId',
      '--limit',
      '1',
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`gh run list failed:\n${result.stderr}`);
    }
    const rows = JSON.parse(result.stdout) as { databaseId: number }[];
    const first = rows[0];
    return first === undefined ? undefined : { id: first.databaseId };
  }

  private readonly approvalTrackers: number[][] = [];

  trackApprovals(): { data: number[] } {
    const tracker: number[] = [];
    this.approvalTrackers.push(tracker);
    return { data: tracker };
  }

  // The gate approval is the one raw API call in the flow: the pending deployments
  // endpoint wants the run's waiting environment ids back, marked approved.
  async approveRun(runId: number): Promise<void> {
    const path = `repos/{owner}/{repo}/actions/runs/${runId}/pending_deployments`;
    const pending = await this.runGh(['api', path]);
    if (pending.exitCode !== 0) {
      throw new Error(`gh api ${path} failed:\n${pending.stderr}`);
    }
    const rows = JSON.parse(pending.stdout) as { environment: { id: number } }[];
    const approval = await this.runGh([
      'api',
      '-X',
      'POST',
      path,
      ...rows.flatMap((row) => ['-F', `environment_ids[]=${row.environment.id}`]),
      '-f',
      'state=approved',
      '-f',
      'comment=approved by ekohacks release ship',
    ]);
    if (approval.exitCode !== 0) {
      throw new Error(`gh api -X POST ${path} failed:\n${approval.stderr}`);
    }
    for (const tracker of this.approvalTrackers) {
      tracker.push(runId);
    }
  }

  async run(runId: number): Promise<RunState> {
    const result = await this.runGh([
      'run',
      'view',
      String(runId),
      '--json',
      'status,conclusion,url',
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`gh run view ${runId} failed:\n${result.stderr}`);
    }
    const row = JSON.parse(result.stdout) as { status: string; conclusion: string; url: string };
    return {
      concluded: row.status === 'completed',
      passed: row.conclusion === 'success',
      url: row.url,
    };
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
