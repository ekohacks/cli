import { describe, expect, it } from 'vitest';
import { ClaudeWrapper } from '../../src/infrastructure/claude.ts';

describe('ClaudeWrapper', () => {
  it('answers the configured response and records the prompt it was asked', async () => {
    const claude = ClaudeWrapper.createNull({ responses: ['the drafted prose'] });
    const prompts = claude.trackPrompts();

    const text = await claude.complete('draft the ekolite/testing page');

    expect(text).toBe('the drafted prose');
    expect(prompts.data).toEqual(['draft the ekolite/testing page']);
  });
});
