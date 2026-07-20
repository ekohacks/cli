# Story 2: `ekohacks release cut <version>`

**Why this exists**

Once preflight is green, the mechanical middle of RELEASING.md begins: branch `release/vX.Y.Z` off `main`, bump the version, commit, push, open the release PR, watch CI, merge on green. None of it needs judgement, all of it was typed by hand for 0.4.0, and each step has one correct next step. This story encodes that rail, and stops before anything irreversible beyond a merged PR.

## The flow

a. **The branch and bump.** `GitWrapper` grows branch, commit and push; `NpmWrapper` grows the version bump. The `Cut` policy drives them in order and refuses to start unless preflight passes.

b. **The PR.** A `GhWrapper` opens the PR with the title `chore: release X.Y.Z` and a body built from the changelog entry. Its `createNull()` answers with a configured PR number and records what was opened.

c. **Watching CI.** The policy polls the PR checks through `GhWrapper` until they conclude, then merges on green or stops with the failing check named. The null configures a sequence of check states, so the waiting logic is tested without a real CI run.

d. **The command.** `ekohacks release cut 0.5.0` runs preflight, then the rail, narrating each step, and ends with the merged PR number or the reason it stopped.

## Done when

- From a ready repo, one command produces a merged release PR and a `main` that carries the bump and the changelog.
- Every stop condition (preflight fails, CI red, merge conflict) is pinned against the nulls and stops the rail with a named reason, leaving the repo in a state the human can pick up by hand.

## Not in this story

The GitHub Release, the gate, npm. That is story 3. Retrying or rolling back a half-finished cut: the command must stop cleanly and say where it stopped, and the human finishes by hand.
