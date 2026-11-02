import { expect, it } from 'vitest';
import type { ClaudeWrapper } from '../../src/infrastructure/claude.ts';

// The behaviour every ClaudeWrapper must honour, real or null (observatory ADR 0023, rule
// three). The model's words cannot be predicted, so the contract asks for text and for the
// prompt on the tracker; the null is handed the words it answers with.
export type MakeClaude = (responses: string[]) => Promise<ClaudeWrapper>;

const PROMPT = 'Reply with the single word: ready.';

export function claudeContract(make: MakeClaude): void {
  it('answers text to a prompt and records the prompt it was asked', async () => {
    const claude = await make(['ready.']);
    const prompts = claude.trackPrompts();

    const text = await claude.complete(PROMPT);

    expect(text.trim().length).toBeGreaterThan(0);
    expect(prompts.data).toEqual([PROMPT]);
  });
}
