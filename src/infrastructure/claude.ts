type Complete = (prompt: string) => Promise<string>;

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 16000;

// Wraps the one model call the drafting policy needs: a prompt in, the text out. Real and null
// share every line above the bottom layer — create() reaches the SDK through a dynamic import
// so the other commands never pay for a client nobody asked for, and stops with a named reason
// when the optional peer dependency is absent; createNull() answers configured text in order,
// imports nothing, and never opens a socket. Both record every prompt through complete(), the
// way NpmWrapper records every bump, so a test can pin what the policy asked without a spy.
export class ClaudeWrapper {
  static async create({
    apiKey = process.env.ANTHROPIC_API_KEY,
  }: { apiKey?: string } = {}): Promise<ClaudeWrapper> {
    const sdk = await import('@anthropic-ai/sdk').catch(() => undefined);
    if (sdk === undefined) {
      throw new Error('docs draft needs @anthropic-ai/sdk — npm i -g @anthropic-ai/sdk');
    }
    const client = new sdk.default({ apiKey });
    return new ClaudeWrapper(async (prompt) => {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'adaptive' },
        messages: [{ role: 'user', content: prompt }],
      });
      return message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    });
  }

  static createNull({ responses = [] }: { responses?: string[] } = {}): ClaudeWrapper {
    let round = 0;
    return new ClaudeWrapper((_prompt) => {
      const index = Math.min(round, responses.length - 1);
      round += 1;
      return Promise.resolve(responses[index] ?? '');
    });
  }

  private readonly runComplete: Complete;
  private readonly promptTrackers: string[][] = [];

  private constructor(runComplete: Complete) {
    this.runComplete = runComplete;
  }

  trackPrompts(): { data: string[] } {
    const tracker: string[] = [];
    this.promptTrackers.push(tracker);
    return { data: tracker };
  }

  async complete(prompt: string): Promise<string> {
    const text = await this.runComplete(prompt);
    for (const tracker of this.promptTrackers) {
      tracker.push(prompt);
    }
    return text;
  }
}
