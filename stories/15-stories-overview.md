# Story 15: the board at a glance

**Why this exists**

Midway through the user test that retired the Gleamcave board, the tester wanted one
thing the CLI could not say: every column with its count. The workaround was rerunning
the raw GraphQL baseline query by hand — the exact move the stories commands exist to
retire. And the overview closes the discoverability gap of story 14 from the other
side: the named stop lists the board's columns after a wrong guess; the overview shows
them before anyone has to guess.

## The flow

a. **Fetch with just a team.** No new subject: `ekohacks stories fetch GLE` with no
column is the overview. One line per column, `Backlog: 33`, pipeable like every other
read.

b. **One walk, grouped locally.** A single paginated query filtered by team alone
answers identifiers with their column names; the counting happens locally. A board of
seven columns costs one walk, not seven, and every page is narrated like every other
read.

c. **Empty columns are rows too.** The board's own columns — the states query story 14
introduced — seed the counts, so `In Review: 0` prints instead of vanishing; the point
of an overview is seeing the whole board, not the busy part. The states now carry their
board position, so the columns print in the order the board shows them rather than the
order the API happens to answer — which tidies story 14's stop message for free.

d. **The stops are story 14's.** An unknown team is the same named stop; there is no
column to mistype.

## Done when

- Against a real board, `ekohacks stories fetch <team>` prints every column with its
  count, zeros included, in board order, and the counts match a hand-rolled GraphQL
  group-by.
- An unknown team stops with its named reason; every page of the walk is narrated.
- Every behaviour is pinned against the null; no mocks, no spies.

## Not in this story

A JSON backup for the overview — the per-column fetch already writes the real backup.
Filters, sorting, or counts by label. Cross-team overviews: one team per call, as
everywhere. Story text beyond the count — the overview answers "how big", the
per-column fetch answers "what".
