import { describe, expect, it } from 'vitest';
import { GhWrapper } from '../../src/infrastructure/gh.ts';

describe('GhWrapper (nulled)', () => {
  it('answers the configured number when opening a pr', async () => {
    const gh = GhWrapper.createNull({ prNumber: 154 });

    expect(await gh.openPr({ title: 'chore: release 0.4.1', body: 'notes' })).toEqual({
      number: 154,
    });
  });

  it('answers configured check rounds in order, repeating the last', async () => {
    const gh = GhWrapper.createNull({
      checkRounds: [
        [{ name: 'build', concluded: false, passed: false }],
        [{ name: 'build', concluded: true, passed: true }],
      ],
    });

    expect(await gh.checks(7)).toEqual([{ name: 'build', concluded: false, passed: false }]);
    expect(await gh.checks(7)).toEqual([{ name: 'build', concluded: true, passed: true }]);
    expect(await gh.checks(7)).toEqual([{ name: 'build', concluded: true, passed: true }]);
  });
});
