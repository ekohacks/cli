# Changelog

All notable changes to `ekohacks` are recorded here.

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
