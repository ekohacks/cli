# AGENTS.md

Everything ordinary about this repo — stack, layout, testing style, workflow — is in
`README.md`, `stories/`, and `package.json`. Read those. Only non-discoverable landmines
live here; when a line's underlying cause gets fixed, delete the line.

- A failing test on `main` is not a bug. It is the committed specification for the next
  piece of work. Make it green by writing production code; never edit a committed red
  test to make it pass, and never commit production code in the same commit as the test
  that specifies it.
- There is deliberately no build step. The `.ts` files run directly on Node 24's type
  stripping, so the explicit `.ts` extensions in imports are load-bearing — don't
  "correct" them to `.js`, and don't add tsc emit or a bundler.
- If anything in this repo surprises or confuses you, flag it in your reply. Those flags
  are how lines get added here — and how the codebase gets fixed so they can be deleted.
