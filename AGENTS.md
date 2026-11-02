# AGENTS.md

Everything ordinary about this repo — stack, layout, testing style, workflow — is in
`README.md`, `stories/`, and `package.json`. Read those. Only non-discoverable landmines
live here; when a line's underlying cause gets fixed, delete the line.

- A failing test is the specification for the next piece of work, reviewed before any
  production code exists, on the pull request and not on `main`: the red commit first, the
  green commit second, and `main` receives only green, so the publish rail and the full
  suite in pre-push always stand on a green trunk. A specification that must wait on
  `main` unimplemented is committed as `it.fails` (or `it.todo` while it has no body) and
  flipped to `it` in the green commit; `it.fails` passes while the test fails for any
  reason, so the red commit must show the failure you meant. Make it green by writing
  production code; never edit a committed red test to make it pass, and never commit
  production code in the same commit as the test that specifies it. The gate contract
  behind this is ADR 0023 in the observatory repository (`docs/adr/0023-one-gate-script-for-every-repo-green-trunk.md`),
  decided 2026-11-02; the pre-push hook runs `npm run gate`, the whole of it.
- There is deliberately no build step in development. The `.ts` files run directly on
  Node 24's type stripping, so the explicit `.ts` extensions in imports are load-bearing
  — don't "correct" them to `.js`, and don't add a dev-time build or a bundler. The one
  exception is publishing: Node refuses type stripping under `node_modules`, so `prepack`
  emits plain JS to `dist/` (`tsconfig.build.json`, `rewriteRelativeImportExtensions`)
  and the npm tarball ships only that.
- A corollary: types are stripped, not checked, at run time. A committed red test that
  calls a not-yet-implemented option (`create({ cwd })` before `cwd` exists) runs anyway
  with the option silently ignored — one such red test ran `npm version` against this
  repo instead of its temp dir. Run `npm run typecheck` on the red half too, and keep
  red tests that reach real infrastructure pointed at throwaway state.
- If anything in this repo surprises or confuses you, flag it in your reply. Those flags
  are how lines get added here — and how the codebase gets fixed so they can be deleted.
