# Changelog

All notable changes to `ekohacks` are recorded here.

## 0.8.0

### Added

- **`stories fetch` with just a team is the board at a glance.** `ekohacks stories fetch DOJ`
  prints every column with its count — zeros included, in the order the board shows its
  columns — from one paginated walk of the whole team, counted locally. The overview the
  user test reached for and found missing, specified in
  [story 15](stories/15-stories-overview.md). Board order comes from the states' positions,
  which tidies the unknown-column stop message for free.

### Changed

- **Unknown teams and columns are named stops.** `stories fetch` and `stories archive` used
  to answer a mistyped team or column with silence — `page 1: 0 stories` or
  `nothing to archive` — indistinguishable from a legitimately empty column. User testing
  on a real board hit it twice in an hour: once through a stale key for the wrong
  workspace, once through `InProgress` typed for "In Progress". Both now stop before any
  page is read: an unknown team answers `no team with key GLE`, the words `create`
  already used, and a mistyped column names what the board actually has —
  `no column "InProgress" in GLE (it has: Backlog, Todo, In Progress, …)`. A genuinely
  empty column still reads and converges exactly as before.

### Fixed

- **Unlabelled stories drop the empty bracket.** `stories fetch` printed
  `DOJ-40 [] Metered billing` for a story with no labels; the bracket now appears only
  when there are labels to put in it.

## 0.7.0

### Added

- **`ekohacks stories fetch <team> <column> [out.json]`.** The Linear board as a surface, in the
  practice's language: cards are stories, so the command is `stories`, and Linear stays an
  infrastructure detail. Fetch reads a whole column across cursor pages — every page narrated, so
  reading page one and declaring victory stays impossible — prints one pipeable
  `DOJ-77 [xp] title` line per story, sorted, and writes the full six-field JSON when given a
  file: the backup archiving asks for. Needs `LINEAR_API_KEY`; a missing key stops with a named
  reason before any request.
- **`ekohacks stories archive <team> <column>`.** Empties a column once it has been read —
  archive, not delete, so the record survives the tidying and stays queryable. Batches 25
  `issueArchive` calls per request behind GraphQL aliases and converges by re-fetching until the
  column answers empty, so a re-run after a partial failure picks up exactly where it stopped.
  Nothing is archived without the confirm naming the count; `--yes` answers it for automation.
- **`ekohacks stories create <team> <backlog.json>`.** Pushes a new project's backlog from a JSON
  file of `{ title, description, children }`, nesting to any depth, parents created before
  children so each child carries its parent's minted id. `--dry-run` prints the would-have tree
  and never touches the board; an unknown team key, a missing title and an unapproved confirm
  each stop with their named reason and create nothing.

## 0.6.0

### Added

- **`eko`, a short alias for the CLI.** The package now installs two bins, `ekohacks` and `eko`,
  both the same command — `eko release 0.6.0`, `eko docs check`. The long name stays canonical in
  the usage text; the short one is there for the hands that type it all day.

## 0.5.1

### Fixed

- **`ekohacks release ship` resumes at the gate.** When a Release has already been cut but its
  publish is stalled waiting on the deployment gate, ship now steps over the cut — skipping the
  confirm that has nothing to confirm and the `gh release create` that would fail with
  `Release.tag_name already exists` — and goes straight to approving the gate. Born from the
  0.5.0 release, where exactly that happened: a correct Release sat behind an un-approved gate and
  re-running ship died on the 422 instead of picking up where it left off. A first run, with no
  Release yet, still asks and cuts as before; the gate's own confirm still asks.

## 0.5.0

### Added

- **`ekohacks docs draft`.** The third phase of the docs work: the model fills the scaffold
  `docs sync` stamps. For each page carrying a draft block, it writes one prompt — the entry
  point, its exports map entry, the stub as it stands, and two existing docs pages verbatim as
  the voice sample — sends it to `claude-opus-4-8`, and lands the prose inside the block,
  touching nothing a person wrote. It then opens a PR that names each drafted entry point and
  states plainly that the prose is machine-drafted and unreviewed, and never merges — where
  `release cut` pauses for a human, this stops for good. The gate asks before it spends, prints
  the pages and the call count, checks the PR branch before the first call so a repeat run stops
  for free, and stops with a named reason when `ANTHROPIC_API_KEY` is unset. `--yes` skips the
  prompt.
- **The Claude API is an optional peer dependency.** `@anthropic-ai/sdk` is reached through a
  dynamic import only `docs draft` triggers, so `release`, `docs check` and `docs sync` never
  pull an API client onto a global install. Run `docs draft` without it and the command stops
  with a named reason. Installing globally still needs the SDK installed alongside; `npx` needs
  it named on the command.

### Changed

- **`docs sync` stubs now carry a draft block.** A scaffolded page wraps its placeholder example
  and "what works today" region in `<!-- ekohacks:draft -->` … `<!-- /ekohacks:draft -->`, the
  seam `docs draft` writes into. A stub scaffolded by 0.4.0 has no block; re-running `docs sync`
  is not needed for pages a person has taken over, but a stub still bearing the block is what
  `docs draft` fills.

## 0.4.0

### Added

- **`ekohacks docs sync`.** The mechanical half of the drift `docs check` names, done by the
  tool instead of by hand: the `<!-- ekohacks:entry-points -->` block gains an entry point the
  exports map declares and loses one it no longer does, and every "N entry points" claim
  follows the real count in the form it was written — `Five` becomes `Six`, a digit stays a
  digit. An entry point the block just gained is scaffolded as `docs/<name>.md`, carrying the
  import line, a TODO everywhere prose belongs, and the exact sidebar line to add to
  `config.mts` by hand. `--dry-run` prints what it would write and writes nothing. Build
  output, unclosed blocks and pages that already exist are left alone; running it twice
  changes nothing the second time.

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
