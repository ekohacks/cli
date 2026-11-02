import { describe, expect, it } from 'vitest';
import { ClaudeWrapper } from '../../src/infrastructure/claude.ts';
import { claudeContract } from './claudeContract.ts';

describe('ClaudeWrapper (nulled)', () => {
  claudeContract((responses) => Promise.resolve(ClaudeWrapper.createNull({ responses })));

  it('answers the configured responses in order, repeating the last', async () => {
    const claude = ClaudeWrapper.createNull({ responses: ['first', 'second'] });

    expect(await claude.complete('one')).toBe('first');
    expect(await claude.complete('two')).toBe('second');
    expect(await claude.complete('three')).toBe('second');
  });
});
