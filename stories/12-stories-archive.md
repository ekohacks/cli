# Story 12: `ekohacks stories archive`

**Why this exists**

Once a column has been read and audited, the board should go back to the present tense —
the housekeeping the workshop did for the DOJ and EkoLite boards, 189 stories at a time,
with a shell script. Tidying a board before a new project starts is the same move; this
story makes it a guarded command instead of shell copied out of teaching material.

Archive, not delete. Archiving is reversible in Linear and archived stories stay
queryable with `includeArchived: true`, so the record the column holds — the syllabus —
survives the tidying. A hard `issueDelete` waits until archiving proves insufficient.

## The flow

a. **Aliases batch the mutation.** GraphQL runs one operation per request, but aliases
(`a0:`, `a1:`, …) let a single mutation carry many `issueArchive` calls, 25 per request,
so a hundred stories cost four round trips instead of a hundred. The ids interpolated
into the mutation are UUIDs the API itself answered.

b. **Convergence makes re-runs safe.** Archived stories drop out of default query
results, so the loop re-fetches the first page of the column until it comes back empty.
A re-run after a partial failure picks up exactly where it stopped. A request whose
successes fall short of its batch stops the loop with both counts rather than spinning.

c. **The one human decision stays human.** Nothing is archived without the confirm
answering yes; the question names the count, or "100 or more" when a full first page
hides the true count behind the cursor. `--yes` answers it for automation, and a fetch
into a JSON file first is the belt-and-braces backup.

## Done when

- On a board with a populated column, `ekohacks stories archive <team> <column>`
  empties it, and a following `stories fetch` prints nothing.
- Answering no archives nothing; a re-run after a partial failure archives only the
  remainder.
- Every behaviour is pinned against the null; no mocks, no spies.

## Not in this story

`issueDelete` — reversibility is the point. Unarchiving. Archiving a filtered subset
of a column: the unit of housekeeping is the column, as it was in the workshop.
