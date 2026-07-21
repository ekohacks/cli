# Story 5: ekohacks ships itself

**Why this exists**

The command has released EkoLite, but the CLI itself is not installable: `ekohacks` is
unclaimed on npm and this repo has none of the rails its own command assumes — no
changelog, no package smoke, no CI, no publish workflow, no gate. This story gives the
repo those rails, and ends with the pleasing recursion: `ekohacks release` releasing
`ekohacks`.

## The flow

a. **The record.** `CHANGELOG.md` seeded with the `0.1.0` entry — the release command
and its stages, written as release notes, because preflight demands it and the Release
will carry it.

b. **The smoke.** `npm run test:package` packs the tarball, installs it into a project
outside the repo, and proves the packed bin answers its usage. This smoke found the
story's one real discovery before the first publish did: Node refuses to strip types
under `node_modules`, so an installed package must ship JavaScript. The repo stays
no-build for development; `prepack` emits `dist/` and the tarball carries only that —
which also means nothing untracked or internal ever ships.

c. **The checks.** `ci.yml` runs typecheck, both suites, the package smoke and the
format check on PRs and `main`. This is a hard prerequisite for the rail: cut waits for
checks to exist, so a repo with no CI would wait forever.

d. **The publish rail.** `publish.yml` fires when a GitHub Release is published, waits
on the `release` environment gate, and publishes with OIDC trusted publishing —
`prepublishOnly` re-runs typecheck and tests as the last line of defence. No token
exists anywhere.

e. **The bootstrap.** npm requires a package to exist before a trusted publisher can be
configured for it, so `0.1.0` is cut with the command but published once by hand from a
maintainer's machine. Then the trusted publisher is configured on npmjs.com, and every
release after ships end to end through the gate.

## Done when

- `npx ekohacks` works from a clean machine and answers its usage.
- A GitHub Release on this repo publishes to npm through the gate, with provenance.
- A release soon after `0.1.0` is run entirely as `ekohacks release <version>`, in this
  repo, and the terminal scrollback shows the CLI releasing itself.

## Not in this story

Extracting these rails into `ekohacks scaffold`: build them here by hand first, extract
the template when a second repo needs it. Any new release behaviour: the command already
knows how to release; this story only gives its own repo the conditions it checks for.
