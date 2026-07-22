# Changelog

All notable changes to `ekohacks` are recorded here.

## 0.3.0

### Added

- **Ship verifies the cut.** `ekohacks release ship` now reads the version `main`
  carries on origin before cutting the Release, and stops with the mirror of cut's
  guard — "main carries 0.1.1, not 0.2.0: the cut looks unfinished, run
  `ekohacks release cut 0.2.0`" — instead of tagging a Release at the wrong commit.
  Born from the 0.2.0 release, where exactly that happened and only npm's refusal to
  publish over an existing version held the line.

## 0.2.0

### Added

- **`ekohacks docs check`.** The docs drift gate: reads a package's real public entry
  points from the `package.json` exports map and fails, by name, when the docs disagree
  — an entry missing from the `<!-- ekohacks:entry-points -->` block the tool owns, a
  documented entry gone from the exports, an "N entry points" prose claim with the
  wrong number, or a broken VitePress build. Born from EkoLite 0.4.0 shipping a wrong
  public surface to the auto-deployed docs site; exits 0 only when the docs match the
  shipped exports.

## 0.1.1

### Fixed

- **Missing release files stop with a name.** Running `ekohacks release` in a directory
  without a `CHANGELOG.md`, `package.json` or `package-lock.json` now stops with the
  missing file named, instead of a stack trace.
- **A finished cut is diagnosed, not crashed into.** When `package.json` already carries
  the target version, cut stops with "the cut looks finished, run
  `ekohacks release ship`" instead of failing inside `npm version` — the named exit for
  re-running a release whose PR was already merged.

## 0.1.0

### Added

- **`ekohacks release <version>`.** EkoLite's RELEASING.md as one command: preflight,
  cut and ship in order, stopping at the first failure with a named reason. It pauses
  before the merge, the Release and the deployment gate; `--yes` skips the first two
  pauses, and the gate always asks.
- **`ekohacks release preflight <version>`.** The "Before cutting" checklist as a
  command: changelog entry, version unpublished, on `main`, in sync with origin, clean
  tree, lockfile registry, package smoke.
- **`ekohacks release cut <version>`.** Branch, bump, commit, push, open the release
  PR, wait for CI, merge on green — stopping cleanly, by name, when it cannot continue.
- **`ekohacks release ship <version>`.** Cut the GitHub Release from the changelog
  entry, approve the publish gate, watch the run, and report success only once the
  registry serves the version.
