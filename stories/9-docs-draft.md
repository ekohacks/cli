# Story 9: `ekohacks docs draft`

**Why this exists**

Sync stamps a skeleton with a placeholder where the example should be, so the honest state of
a scaffolded page is "somebody still has to write this". That somebody writes the same shape
every time: what the entry point is, one example that runs, what works today — in a voice the
rest of the docs already establish. Phase 3 of the brief is the ambitious tail, and what makes
it safe to try now is that the two phases below it are the guardrails. The detector says what
is missing, the scaffold says where it goes, and the draft only fills a hole both have already
named.

The decision this story makes is where the model is allowed to write: the placeholder region
of a stub, and nothing else. The block, the counts and every page a person wrote stay
untouched, so the worst case for a bad draft is an unhelpful paragraph on a page nobody had
written yet — reviewed in a PR, never merged by the tool.

## The flow

Each behaviour is one red/green loop, red committed and reviewed before green is written.

a. **A nullable wrapper around the model.** `ClaudeWrapper.create()` calls the Messages API
through `@anthropic-ai/sdk` — `claude-opus-4-8`, adaptive thinking, one non-streaming call per
page — and answers the text it produced. `createNull({ responses })` answers configured text,
records every prompt it was asked, and never opens a socket. This is the package's first
runtime dependency; `files: ["dist"]` keeps the tarball our code only, but a consumer now
installs the SDK too.

b. **The prompt carries the house voice from the repo.** The policy builds one prompt per
undrafted entry point: what the entry point is, its exports map entry, the stub as it stands,
and two existing docs pages verbatim as the voice sample. No style guide gets written down —
the repo is the style guide, and quoting it means the voice tracks the docs instead of drifting
from a copy of them.

c. **The draft lands in the placeholder.** The returned prose replaces the placeholder region
of the stub and nothing else. A page without a placeholder is skipped rather than rewritten.
Pinned against the null with a canned response: the assertion is where it landed and what
stayed.

d. **A PR, never a merge.** With the drafts written, the command branches, commits, pushes and
opens a PR through the existing `GitWrapper` and `GhWrapper`, with a body naming each entry
point drafted and stating plainly that the prose is machine-drafted and unreviewed. Nothing
waits for checks and nothing merges — where `release cut` pauses for a human, this stops for
good.

e. **The gate asks before it spends.** The command prints the entry points it would draft and
how many calls that is, and asks once before the first one. `--yes` is the same escape hatch
`release` already carries. With no `ANTHROPIC_API_KEY` it stops with a named reason before
touching anything.

## Done when

- Run inside EkoLite against a freshly scaffolded stub, `ekohacks docs draft` opens a PR whose
  diff touches only placeholder regions, and the prose reads like the pages beside it. That
  last judgement is a person's, and it is the acceptance test.
- Declining the prompt makes no API call and leaves the tree clean.
- Every behaviour is pinned against the nulls; the model's output is configured, never asserted
  for quality. The real side of the wrapper is proven by one integration test under
  `npm run test:integration`, with the other real wrappers, needing a key and kept out of the
  default suite.

## Not in this story

Rewriting or improving prose a human wrote — draft only fills placeholders. Auto-merging,
waiting on checks, or answering review comments. Per-repo model choice, effort tuning, or
streaming: one page, one call. Drafting anything that is not an entry point page — changelog
entries, API reference pages and release notes each have their own source of truth and would
each be their own story.
