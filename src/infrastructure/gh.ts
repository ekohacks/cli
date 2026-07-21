type OpenPrOptions = { title: string; body: string };

export interface PrCheck {
  name: string;
  concluded: boolean;
  passed: boolean;
}

// Wraps the GitHub surface the CLI needs, behind the gh CLI. The null answers configured
// state and never talks to GitHub; the real side is proven by a real release rather than
// a faked GitHub. checkRounds configures successive answers to checks(): each call takes
// the next round, and the last round repeats, so a test can walk a PR from pending to
// concluded.
export class GhWrapper {
  static createNull({
    prNumber = 1,
    checkRounds = [[]],
  }: { prNumber?: number; checkRounds?: PrCheck[][] } = {}): GhWrapper {
    return new GhWrapper(prNumber, checkRounds);
  }

  private readonly prNumber: number;
  private readonly checkRounds: PrCheck[][];
  private round = 0;

  private constructor(prNumber: number, checkRounds: PrCheck[][]) {
    this.prNumber = prNumber;
    this.checkRounds = checkRounds;
  }

  openPr(_options: OpenPrOptions): Promise<{ number: number }> {
    return Promise.resolve({ number: this.prNumber });
  }

  checks(_prNumber: number): Promise<PrCheck[]> {
    const index = Math.min(this.round, this.checkRounds.length - 1);
    this.round += 1;
    return Promise.resolve(this.checkRounds[index] ?? []);
  }

  private readonly mergeTrackers: number[][] = [];

  trackMerges(): { data: number[] } {
    const tracker: number[] = [];
    this.mergeTrackers.push(tracker);
    return { data: tracker };
  }

  mergePr(prNumber: number): Promise<void> {
    for (const tracker of this.mergeTrackers) {
      tracker.push(prNumber);
    }
    return Promise.resolve();
  }
}
