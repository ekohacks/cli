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
- A corollary: types are stripped, not checked, at run time. A committed red test that
  calls a not-yet-implemented option (`create({ cwd })` before `cwd` exists) runs anyway
  with the option silently ignored — one such red test ran `npm version` against this
  repo instead of its temp dir. Run `npm run typecheck` on the red half too, and keep
  red tests that reach real infrastructure pointed at throwaway state.
- If anything in this repo surprises or confuses you, flag it in your reply. Those flags
  are how lines get added here — and how the codebase gets fixed so they can be deleted.
