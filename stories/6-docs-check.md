# Story 6: `ekohacks docs check`

**Why this exists**

EkoLite 0.4.0 added `ekolite/react` to the exports map, and the docs kept advertising
three entry points. Nothing failed: `docs.yml` builds VitePress and publishes to GitHub
Pages on every merge to `main`, so the wrong surface shipped automatically and was caught
by a person happening to look. It has already drifted again — the exports map now has
five entries, and `README.md` and `docs/quick-start.md` say "Four entry points" and never
list `ekolite/config`. This story makes the drift a failing check: a release that changes
the public surface cannot merge until the docs match the shipped exports.

The brief left one decision open: what counts as a "documented entry point"? Parsing
prose is brittle, and a side manifest can itself drift from what readers see. The answer
here is a marked block the tool owns — `<!-- ekohacks:entry-points -->` around the
import example the docs already carry — so the checked content is exactly the content
on the page, and the block is the seam a later scaffold command can rewrite.

## The flow

Each behaviour is one red/green loop, red committed and reviewed before green is written.

a. **The exports map knows the entry points.** `entryPointsFrom(pkg, exports)` turns the
`package.json` exports map into the specifiers a consumer imports: `.` is the bare
package name, `./react` is `pkg/react`. A package with no exports map has one entry:
itself. Pure logic.

b. **The docs declare theirs in a block the tool owns.** Any docs file may carry an
`<!-- ekohacks:entry-points -->` … `<!-- /ekohacks:entry-points -->` block; the check
reads the import specifiers inside it, ignores other packages, and demands set equality
with the real entry points — one named check per carrying file, failing with what is
not listed and what is no longer exported. No file carrying the block at all is its own
failure, so the gate cannot be switched off by deleting it. Files under `.vitepress/`
are never scanned.

c. **The prose count cannot lie.** Any "N entry points" claim in a docs file — digit or
word — is checked against the real count. This is the exact line that shipped wrong in
0.4.0 and is wrong again today.

d. **The site still builds.** The existing `ProcessRunner` runs `npm run docs:build` and
a broken VitePress build fails its own named check.

e. **The command reports.** `ekohacks docs check` prints one line per check, pass or
fail with the reason, and exits 0 only when everything passes. The thin shell reads
`README.md` and every markdown file under `docs/`; the policy judges.

## Done when

- `ekohacks docs check` run inside the EkoLite repo today fails, naming
  `ekolite/config` as not listed and the four-versus-five count, and exits 1.
- After EkoLite's docs adopt the block and fix the list, the same command exits 0 —
  and a follow-up PR wires it into EkoLite's `ci.yml` as a pre-merge gate.
- Every behaviour is pinned against the nulls; no mocks, no spies.

## Not in this story

Parsing the VitePress nav/sidebar (`config.mts` is code; the build check is the only
site-level gate for now). Comparing the shipped `.d.ts` surface. Exports subpath
patterns (`./*`) — EkoLite uses literal keys, and its conventions stay hardcoded until
a second consumer exists. Scaffolding stubs for new entries (Phase 2) and drafted prose
(Phase 3) wait until this detector has earned trust.
