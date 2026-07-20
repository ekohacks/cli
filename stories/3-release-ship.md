# Story 3: `ekohacks release ship <version>`

**Why this exists**

The tail of RELEASING.md is where the release becomes real: cut the GitHub Release with the changelog entry as its notes, approve the `release` environment gate, watch the publish run, and confirm the registry serves the new version. It is also the least familiar part to do by hand: the gate approval is a raw API call to the pending deployments endpoint. This story encodes the tail, with the one human decision kept human: the command asks before it approves the gate.

## The flow

a. **The Release.** `GhWrapper` grows release creation: tag `vX.Y.Z` on `main`, title `vX.Y.Z`, notes from `changelogEntryFor`. The null records what was created.

b. **The gate.** The policy finds the waiting publish run, asks for confirmation, and approves the gate through the pending deployments endpoint. The null configures a waiting run and records the approval; the confirm is injectable so tests cover both answers.

c. **Watching the publish.** The policy follows the run to its conclusion and fails loudly if the run does, with a pointer to its log.

d. **The registry check.** `NpmWrapper` confirms the registry serves the new version, polling briefly for propagation. Ship only reports success after the registry does.

e. **The command.** `ekohacks release ship 0.5.0` narrates: Release cut, gate approved, publish green, registry confirms. Anything less ends non-zero with the step that stopped it.

## Done when

- From a merged release PR, one command (and one typed yes at the gate) ends with the version live on npm and verified.
- The gate is never approved without the confirm, pinned by a test where the answer is no.
- Every failure path (no waiting run, publish run fails, registry never shows the version) stops with a named reason.

## Not in this story

Chaining from preflight through ship: story 4. Unpublishing or any recovery beyond reporting exactly where things stopped.
