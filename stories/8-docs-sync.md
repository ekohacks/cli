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

b. **The block gains what the exports added.** A missing specifier is inserted into the block
as an import line copying the shape of the last import line already there — named, default or
bare — with the new specifier substituted, in the order the exports map declares. A block with
no line to copy gets `import '<specifier>';`.

c. **The block loses what the exports dropped.** An import line whose specifier is no longer
exported is removed, and nothing else inside the block moves.

d. **The count follows the exports.** Every "N entry points" claim is rewritten to the real
count in the form it was written: a digit stays a digit, `Four` becomes `Five`, `four` becomes
`five`. Above ten there is no word form, so the claim is rewritten as a digit.

e. **A new entry point gets a stub.** For each entry point with no page, sync writes
`docs/<name>.md`: a heading, the import line, a fenced example marked as a placeholder, a
"What works today" bullet, and a line naming the exact `config.mts` sidebar entry a human must
add. An existing file is never overwritten. The bare package name has no stub — the front page
documents it.

f. **The command writes and reports.** `ekohacks docs sync` prints one line per file written,
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
