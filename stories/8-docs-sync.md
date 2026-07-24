# Story 8: `ekohacks docs sync`

**Why this exists**

`docs check` names the drift; a person still fixes it by hand. When ekolite#199 landed, the
fix was mechanical: add `ekolite/config` to the block, change "Four" to "Five" in two files.
The check earned its keep by finding those, but every future entry point costs the same
manual pass, and the failure mode of a manual pass is the file nobody opened — the import
line gets added and the count three paragraphs down stays wrong. The block story 6 built is
a seam the tool owns, so the tool can write it. This story makes the mechanical half
automatic and leaves the prose to a person: `ekohacks docs sync` edits what it can prove,
stamps a stub for what it cannot, and leaves the repo one `docs check` from green.

The brief left one decision open for Phase 2: where a new entry point's page goes. Deriving
it from the exports map — `ekolite/config` becomes `docs/config.md` — keeps the tool from
having to read the site's layout, and matches story 6's stance that EkoLite's conventions
stay hardcoded until a second consumer exists. `config.mts` stays untouched: it is code, the
check already refuses to parse it, and the stub names the one sidebar line a human adds.

## The flow

Each behaviour is one red/green loop, red committed and reviewed before green is written.

a. **Sync returns edits, it does not write.** `docsSync({pkg, exports, files})` is the mirror
of `docsCheck` — same inputs, and instead of a report it returns the files whose content
should change, each as a whole new body. A file it would leave alone is not in the result, so
the second run of an in-step repo returns nothing. The thin shell does the writing; the policy
stays pure and is pinned without touching a disk.

b. **Build output is never edited.** Files under `.vitepress/` are left alone, the same
exclusion the check applies to scanning. A rendered page can carry a block it inherited from a
source file, and rewriting a build artefact edits something no one committed.

c. **An unclosed block is left alone.** A block whose closing marker is missing is returned
untouched and its file is not an edit. The check already fails it by name and says so; a sync
that guessed where the block ended would be guessing with someone's prose.

d. **The block gains what the exports added.** A missing specifier is inserted after the last
import line already in the block, in the order the exports map declares, as a namespace import:
`import * as config from 'ekolite/config';`. Copying the shape of the neighbouring lines was
the obvious answer and it is the wrong one — a named import needs a binding the exports map
does not name, so the tool would be inventing an API into the docs. A namespace import needs
only the specifier, which the tool does know. It is a scaffold either way, and a person writing
the example replaces it with the real call.

e. **The block loses what the exports dropped.** An import line whose specifier is no longer
exported is removed, and nothing else inside the block moves.

f. **The count follows the exports.** Every "N entry points" claim is rewritten to the real
count in the form it was written: a digit stays a digit, `Four` becomes `Five`, `four` becomes
`five`. Above ten there is no word form, so the claim is rewritten as a digit.

g. **A new entry point gets a stub.** Sync writes `docs/<name>.md` — a heading, the import
line, a fenced example marked as a placeholder, a "What works today" bullet, and a line naming
the exact `config.mts` sidebar entry a human must add. The stub goes to entry points the block
did not already list, not to every entry point without a page of its own: an entry point the
docs already declare is documented somewhere, and scaffolding a page for it would be the tool
inventing work. Where no file carries a readable block there is no such baseline, so nothing is
scaffolded — that repo's problem is the one the check already names. An existing file is never
overwritten, and the bare package name has no stub; the front page documents it.

h. **The command writes and reports.** `ekohacks docs sync` prints one line per file written,
prints that the docs are already in step when there is nothing to do, and exits 0 either way.
`--dry-run` prints the same lines and writes nothing.

## Done when

- Adding a sixth entry point to EkoLite's exports map, then `ekohacks docs sync`, then
  `ekohacks docs check` — the check exits 0 with no hand edits beyond writing the stub's prose.
- Re-running sync against an in-step repo leaves the tree byte-identical and exits 0.
- Every behaviour is pinned against the nulls and the pure policy; no mocks, no spies.

## Not in this story

Editing `config.mts` — nav and sidebar are code, and sync names the line instead of writing
it. Writing prose: every example a stub carries is a placeholder, and drafted prose is story 9.
Choosing a page's location beyond `docs/<name>.md`, or moving and renaming existing pages.
Deleting the page of an entry point that disappeared — sync drops it from the block and leaves
the file, because removing someone's prose is not a mechanical edit.
