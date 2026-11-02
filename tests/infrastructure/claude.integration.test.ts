import { describe } from 'vitest';
import { ClaudeWrapper } from '../../src/infrastructure/claude.ts';
import { claudeContract } from './claudeContract.ts';

// The real side, proven the way the other wrappers' real sides are: against the live service,
// kept out of the default suite. It reads the key from the environment only — never a literal,
// never a committed .env — and skips itself when no key is set, so a checkout without one still
// runs green. When a key is present it makes one small, real, billable call.
const key = process.env.ANTHROPIC_API_KEY;

describe.skipIf(key === undefined || key === '')('ClaudeWrapper (integration)', () => {
  claudeContract(() => ClaudeWrapper.create());
});
