# Story 11: `ekohacks stories fetch`

**Why this exists**

The story-audit session in ekohacks-dojo reads a whole Linear column with two shell
scripts (`docs/workshop/linear-graphql/` — curl, jq, a cursor loop), and the propi-o
backlog push carries a third in Node. Every board reading starts by copying one of them
out of a teaching repo and re-exporting the same key. The CLI is where a repeated
operation goes once it is boring: this story brings the read half — every story in one
column of one team — into `ekohacks`, and the next two stories reuse its wrapper to
tidy a board for a new project.

The command speaks the practice's language, not the vendor's: the cards are stories
(AoAD2), so the command is `ekohacks stories`, and Linear stays an infrastructure
detail behind the wrapper. The transport is the GraphQL endpoint itself — one POST,
no MCP server between the CLI and the board.

## The flow

a. **A nullable Linear wrapper.** `LinearWrapper.create()` posts to the one GraphQL
endpoint with `LINEAR_API_KEY` from the environment; `createNull()` answers
GraphQL-shaped envelopes from configured pages and never opens a socket. Real and null
share every line above the bottom layer, the same shape as `GhWrapper`.

b. **Pagination as policy.** Linear answers at most 100 issues per request; the cursor
from one page becomes the `after` of the next, and every page count is narrated —
reading page one and declaring victory is the classic mistake the workshop teaches, so
the pages stay visible. The merged result is sorted by issue number.

c. **One line per story, and a backup on request.** `ekohacks stories fetch DOJ Done`
prints `DOJ-77 [xp] title` per story on stdout, pipeable; a third argument writes the
full JSON — six fields per story, the same shape the workshop script saved — which is
the backup the archive story asks for.

## Done when

- `ekohacks stories fetch <team> <column>` against a real board prints every story
  across pages, sorted, and the JSON written with a third argument matches what the
  workshop script fetched.
- A missing `LINEAR_API_KEY` stops with a named reason before any request is made.
- Every behaviour is pinned against the null; no mocks, no spies.

## Not in this story

Archiving (story 12) and creating (story 13). Filters beyond one team and one column.
`includeArchived` — the audit reads the living column. Choosing fields at the command
line: the six fields are the workshop's six until a reader needs a seventh.
