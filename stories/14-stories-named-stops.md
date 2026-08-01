# Story 14: unknown teams and columns are named stops

**Why this exists**

User testing on the Gleamcave board (2026-07-31) hit the same ambiguity twice in one
hour. `ekohacks stories archive GLE InProgress` — a typo for "In Progress" — answered
`nothing to archive`, leaving four live stories untouched and the tester none the wiser.
Earlier, a stale key for the wrong workspace made `fetch` print `page 1: 0 stories` for
a board holding fifty. Both times the command treated "this column does not exist" as
"this column is empty", and only cross-checking with raw GraphQL told them apart.

`create` already refuses an unknown team with a named reason; `fetch` and `archive`
answer silence. This story gives all three the same manners: a team or column that does
not exist is a stop that says so, before any page is read and before anything is asked
to change. An empty backup file should mean the column was empty, never that the name
was wrong.

## The flow

a. **The wrapper learns the board's columns.** One query answers a team's states — the
column names the board actually has — behind the same wrapper, configured pages on the
null. The team-key resolution `create` uses moves down where `fetch` and `archive` can
reach it.

b. **Team first, column second.** Before the first page, the team key resolves or stops:
`no team with key GLE` — the same words `create` uses, and the same stop a
wrong-workspace key earns, since a key for the wrong workspace and a typo'd team are
indistinguishable from where the CLI stands. Then the column name is checked against
the team's states, and the stop names what exists:
`no column "InProgress" in GLE (it has: Backlog, Todo, In Progress, In Review, Done, Canceled, Duplicate)`.

c. **A truly empty column keeps its answers.** `fetch` still prints nothing and exits
zero; `archive` still narrates `nothing to archive` and converges. The behaviours stay;
the ambiguity goes.

## Done when

- `fetch` and `archive` with a mistyped column stop with the column list; with an
  unknown team key they stop naming it; nothing is read or archived first.
- A key for the wrong workspace stops at the team check, not at an empty page.
- A genuinely empty column reads and converges exactly as it does today.
- Every behaviour is pinned against the null; no mocks, no spies.

## Not in this story

Did-you-mean suggestions — naming the real columns is enough. The empty label bracket
(`DOJ-40 [] title`) — its own small fix. A column-less `fetch` overview of the whole
board — its own story, though it shares the states query this one introduces.
`create` — it takes no column and already stops on the team.
