# Story 13: `ekohacks stories create`

**Why this exists**

A new project starts with a planning conversation, and the cards that come out of it
have to reach the board. The propi-o migration pushed a whole phased backlog to Linear
with a one-off Node script whose stories were hardcoded in the source; starting the
next project would mean copying and editing the script. This story makes the backlog a
file and the push a command: write the stories as JSON, preview the tree, and
`ekohacks stories create` puts them on the team's board, parents before children.

## The flow

a. **The backlog is a file.** A JSON list of `{ "title", "description", "children" }`,
nesting to any depth — a phase carries its stories, a story its tasks. A story without
a title stops the command before anything is created, and an empty file is its own
named stop.

b. **The team key is enough.** `issueCreate` wants the team's UUID, which nobody
remembers; the wrapper resolves the key (`DOJ`) to the id with one query, and an
unknown key is a named stop, not a GraphQL error.

c. **Preview first.** `--dry-run` narrates the would-have tree — every title, indented
by depth, and the total — and never touches the board. This is the preview for tidying:
read what a new project will look like before the cards exist.

d. **Depth first, parents first.** Each story is created before its children so the
children carry its id as `parentId`, and the narration mirrors the file's indentation
with the minted identifiers. The confirm names the full count before the first
mutation; `--yes` answers it for automation.

## Done when

- A backlog JSON pushed to a real team appears on the board with the same nesting, and
  the `--dry-run` beforehand printed the same tree with `would have created`.
- An unknown team key, a missing title, and an unapproved confirm each stop with their
  named reason and create nothing.
- Every behaviour is pinned against the null; no mocks, no spies.

## Not in this story

Priorities, estimates, and labels on created stories — the file shape grows a field
when a real backlog needs one. Ordering on the board (Linear lists newest first; the
propi-o script reversed its loops to compensate, and that cosmetic fight is not worth
inheriting). Updating or moving existing cards. Drafting the backlog itself — that is
a planning conversation, not a command.
