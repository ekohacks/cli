# Story 1: `ekohacks release preflight`

**Why this exists**

RELEASING.md has a "Before cutting" checklist that a human runs by eye: is the changelog entry written, is the version actually new, is the tree clean on `main`, does the package smoke pass, has a mirror URL crept into the lockfile. Every one of those is checkable by a machine, and a missed one is either an aborted release or a bad one. This story makes the checklist a command that answers green or names exactly what is missing.

It is also the story that forces the architecture into existence: the first nullable wrappers around `git` and `npm`, and the first pure logic under test, before any command does anything irreversible.

## The flow

Each behaviour is one red/green loop, red committed and reviewed before green is written.

a. **The changelog knows its entries.** `changelogEntryFor(content, version)` returns the entry body for a version heading, without the heading itself, and `undefined` when there is no entry. Pure logic; this same function later feeds the release notes in story 3.

b. **The registry knows the version.** `NpmWrapper` answers "what version of this package is published?"; its `createNull({ publishedVersion })` answers without touching the network. Preflight fails when the target version is already published, or is not ahead of it.

c. **The tree is clean and on main.** `GitWrapper` answers the current branch and whether the working tree is clean; `createNull({ branch, dirty })` configures both. Preflight fails off `main` or with uncommitted work.

d. **The repo's own gates run.** A `ProcessRunner` wrapper executes the repo's package smoke and greps the lockfile for mirror URLs; its null answers with configured exit codes and output. Preflight reports each as its own named check.

e. **The command reports.** `ekohacks release preflight <version>` prints one line per check, pass or fail with the reason, and exits 0 only when everything passes. The CLI entry is a thin shell over the tested `Preflight` policy.

## Done when

- `ekohacks release preflight 0.5.0` run inside the EkoLite repo reports every check and exits 0 when the release is ready to cut, 1 with named reasons when it is not.
- Every check has its behaviour pinned against the nulls, and the wrappers' real sides have integration tests where the real thing is reachable (git and the filesystem; the registry read is proven by use).
- No mocks, no spies anywhere in the suite.

## Not in this story

Cutting a branch, opening a PR, or anything else that writes. Configuration for repos with different conventions: EkoLite's conventions are hardcoded until a second consumer exists.
