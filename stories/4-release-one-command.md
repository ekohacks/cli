# Story 4: `ekohacks release <version>`

**Why this exists**

With preflight, cut and ship each working alone, the release becomes their composition: one command from a clean `main` and a written changelog entry to a verified version on npm, pausing only where a human decision belongs. This is the command RELEASING.md promised, and the acceptance test is the next real EkoLite release, run with it.

## The flow

a. **The chain.** `ekohacks release 0.5.0` runs preflight, cut, ship in order, stopping at the first failure with that stage's own report. No stage's logic is duplicated: the command composes the three tested policies.

b. **The pauses.** Before each irreversible step (the merge, the Release, the gate) the command states what it is about to do and waits for a yes, unless `--yes` is passed for the merge and Release; the gate always asks.

c. **The narration.** The output reads as the release's story, ending with the npm version confirmed, so the terminal scrollback is the release record.

## Done when

- The next EkoLite release ships by running this command, and the only typing beyond it is the changelog entry and the confirmations.
- An abort at any pause leaves the repo in a state preflight can assess again.

## Not in this story

New checks or steps: anything the manual process does not do, the command does not do either. The process changes in RELEASING.md first, by hand, then here.
