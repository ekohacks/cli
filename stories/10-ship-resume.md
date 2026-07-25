# Story 10: ship resumes at the gate

**Why this exists**

Releasing 0.5.0 found the hole. Ship cut the GitHub Release, the publish workflow parked on
the deployment gate waiting to be approved, and there it sat — the gate is patient, so nothing
failed and nothing shipped. Re-running `ekohacks release ship 0.5.0` to finish the job died on
`gh release create v0.5.0: Release.tag_name already exists`: a 422 that killed the process at the
one step with an outside effect, instead of stepping over it to the gate the release was stalled
behind. The registry's immutability caught the wrong Release in story 7; here nothing was wrong —
a correct Release was stranded behind a command that could not get back to it.

Ship's other steps are already idempotent: `versionOnMain` reads, `waitingRun` reads,
`approveRun` is safe to send at a gate already approved, the run and registry polls read. Only
`createRelease` fails a second time, because a tag is a name that cannot be taken twice. This
story teaches ship to notice the Release is already cut and pick up from there.

## The flow

Each behaviour is one red/green loop, red committed and reviewed before green is written.

a. **The gh wrapper answers whether a Release exists.** `releaseExists(tag)` runs `gh release
view` and reads the exit code — zero is present, non-zero is absent, the same way `branchExists`
reads `git branch --list`. The null answers from a configured set of existing releases and never
talks to GitHub; the real side is proven by a real release, like every other line of this
wrapper.

b. **Ship steps over a Release already cut.** Before it asks to cut and before it creates, ship
checks `releaseExists(tag)`. If the Release is there, it narrates that the release is already cut
and goes straight to finding the waiting run and the gate — skipping the cut confirm, which has
nothing to confirm, and the create, which would 422. A first run, with no Release yet, still asks
and cuts exactly as before. The gate's own confirm still asks: resuming approves nothing a human
did not approve.

## Done when

- Re-running the 0.5.0 sequence — Release cut, publish waiting, ship invoked again — reaches the
  gate and approves it, instead of 422-ing on `release create`.
- `ekohacks release <version>` end to end still cuts the Release then approves the gate: the
  resume path is taken only when the Release already exists.
- The resume is pinned against the null; the real release-existence read is proven by a real
  release. No mocks, no spies.

## Not in this story

Resuming past the gate — once the gate is approved the publish run is no longer waiting, so a ship
re-run after approval finds no waiting run and stops, as it does today; picking up a running or
finished publish is its own resume point. Verifying the existing Release points at the right commit
or carries the right notes: ship trusts the Release it finds, and a wrong one is still a human's to
delete, as story 7 left it. Deleting or replacing a Release from ship.
