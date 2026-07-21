type OpenPrOptions = { title: string; body: string };

// Wraps the GitHub surface the CLI needs, behind the gh CLI. The null answers configured
// state and never talks to GitHub; the real side is proven by a real release rather than
// a faked GitHub.
export class GhWrapper {
  static createNull({ prNumber = 1 }: { prNumber?: number } = {}): GhWrapper {
    return new GhWrapper(prNumber);
  }

  private readonly prNumber: number;

  private constructor(prNumber: number) {
    this.prNumber = prNumber;
  }

  openPr(_options: OpenPrOptions): Promise<{ number: number }> {
    return Promise.resolve({ number: this.prNumber });
  }
}
