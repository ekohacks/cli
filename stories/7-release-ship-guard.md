# Story 7: ship verifies the cut

**Why this exists**

Releasing 0.2.0 with the CLI itself found the hole. Cut opened the release PR and
stopped at its unmerged pause — and ship then ran anyway, cutting Release v0.2.0
against a `main` that still said 0.1.1. The publish workflow dutifully packed the
un-bumped tree and the release survived only because npm refuses to publish over an
existing version: the rail failed closed by the registry's immutability, not because
the command knew anything was wrong. A wrong Release existed on GitHub either way and
had to be deleted by hand.

Cut already has the mirror of this guard — "package.json is already at 0.2.0: the cut
looks finished, run `ekohacks release ship`". This story gives ship the other half:
refuse to tag a version that `main` does not carry.

## The flow

Each behaviour is one red/green loop, red committed and reviewed before green is written.

a. **The git wrapper answers the version main carries on origin.** `versionOnMain()`
fetches and reads `origin/main:package.json` — the remote `main`, not this checkout,
because the Release targets GitHub's `main` and a stale local manifest must not answer
for it. The null answers a configured `versionOnMain`; the real side is pinned against
a throwaway repo whose local bump deliberately never reaches its origin.

b. **Ship refuses an unfinished cut.** Before asking anyone to cut the Release, ship
compares `versionOnMain()` with the version it was given and stops with the mirror of
cut's message: `main carries 0.1.1, not 0.2.0: the cut looks unfinished, run ekohacks
release cut 0.2.0`. The full release flow is unaffected — by the time ship runs, cut
has merged the bump onto `main` and the guard sees it.

c. **The shell hands ship the wrapper.** The `ship` subcommand path wires a real
`GitWrapper`; `release` passes through the one it already holds.

## Done when

- Re-running the 0.2.0 sequence — cut's merge declined, ship invoked anyway — stops
  with the named reason instead of creating a Release at the wrong commit.
- `ekohacks release <version>` end to end still ships: the guard reads the bump the
  cut just merged.
- The guard is pinned against the nulls, the real read against a real repo and origin;
  no mocks, no spies.

## Not in this story

Verifying anything about `main` beyond its version — the tag's exact commit, branch
protection, or whether the merged PR was the cut's. Deleting a wrongly cut Release:
that stays a human decision, as does re-running ship after it. Auto-merging the cut
PR from ship — the unmerged pause is deliberate.
