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

  it('records merged pr numbers on its output tracker', async () => {
    const gh = GhWrapper.createNull();
    const merges = gh.trackMerges();

    await gh.mergePr(154);

    expect(merges.data).toEqual([154]);
  });

  it('records opened prs on its output tracker', async () => {
    const gh = GhWrapper.createNull();
    const opens = gh.trackOpens();

    await gh.openPr({ title: 'chore: release 0.5.0', body: 'the changelog entry' });

    expect(opens.data).toEqual([{ title: 'chore: release 0.5.0', body: 'the changelog entry' }]);
  });

  it('records created releases on its output tracker', async () => {
    const gh = GhWrapper.createNull();
    const releases = gh.trackReleases();

    await gh.createRelease({ tag: 'v0.5.0', title: 'v0.5.0', notes: '- **A thing.** (#160)' });

    expect(releases.data).toEqual([
      { tag: 'v0.5.0', title: 'v0.5.0', notes: '- **A thing.** (#160)' },
    ]);
  });

  it('answers the configured waiting publish run', async () => {
    const gh = GhWrapper.createNull({ waitingRunRounds: [123] });

    expect(await gh.waitingRun('publish.yml')).toEqual({ id: 123 });
  });

  it('answers undefined when no run is waiting', async () => {
    const gh = GhWrapper.createNull();

    expect(await gh.waitingRun('publish.yml')).toBeUndefined();
  });

  it('answers waiting run rounds in order, repeating the last', async () => {
    const gh = GhWrapper.createNull({ waitingRunRounds: [undefined, 123] });

    expect(await gh.waitingRun('publish.yml')).toBeUndefined();
    expect(await gh.waitingRun('publish.yml')).toEqual({ id: 123 });
    expect(await gh.waitingRun('publish.yml')).toEqual({ id: 123 });
  });

  it('records approved runs on its output tracker', async () => {
    const gh = GhWrapper.createNull({ waitingRunRounds: [123] });
    const approvals = gh.trackApprovals();

    await gh.approveRun(123);

    expect(approvals.data).toEqual([123]);
  });

  it('answers configured run rounds in order, repeating the last', async () => {
    const url = 'https://github.com/nulled/nulled/actions/runs/123';
    const gh = GhWrapper.createNull({
      runRounds: [
        { concluded: false, passed: false, url },
        { concluded: true, passed: false, url },
      ],
    });

    expect(await gh.run(123)).toEqual({ concluded: false, passed: false, url });
    expect(await gh.run(123)).toEqual({ concluded: true, passed: false, url });
    expect(await gh.run(123)).toEqual({ concluded: true, passed: false, url });
  });
});
