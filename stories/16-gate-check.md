# Story 16: `ekohacks gate check`

**Why this exists**

On 2 November 2026 an audit of five EkoHacks repositories found that three pre-push hooks
ran `vitest --changed`, which on a push that changes only a fixture or a migration runs
zero tests and exits green; that one gate was written in four places with four contents;
that one repository committed red tests to `main`; and that a coverage number could fail
a build. The same day they converged on one contract, observatory ADR 0023: one gate
script that the pre-push hook, the README and CI all call, whole, under ten seconds;
coverage as information; a contract list for every wrapper with a narrow test. The ADR
ends with "revisit when the CLI encodes the contract and the file becomes the description
of a command". This story is that command: it reads a repository's files and names its
drift from the contract, the way `docs check` names docs drift, so the contract is kept by
a check and not by a memory.

## The flow

Each behaviour is one red/green loop, red committed and reviewed before green is written.

a. **The gate is found.** `scripts.gate` in `package.json` makes `npm run gate` the gate;
a `gate.sh` at the root or under `backend/` makes that path the gate. Neither is the first
named failure, and the rest cannot be judged without it.

b. **The gate is whole.** Its text, with every script it names expanded one level, runs
the suite (`npm test`, or `pytest`), never the changed-only shortcut; type-checks, where
there is a `package.json`; lints, where a lint script or `ruff check` exists; and checks
formatting as a check, `format:check` or `prettier --check` or `ruff format --check`.

c. **The format check reads tracked files.** `prettier --check .` reads every file on
disk, and an uncommitted draft blocked a push of five green commits the day the gate went
in. The check names the fix: `git ls-files -z | xargs -0 prettier --check --ignore-unknown`,
or `git ls-files` feeding `ruff format --check`.

d. **The hook, the README and CI call it.** `.husky/pre-push` runs the gate command and
nothing less, or `.pre-commit-config.yaml` carries a `pre-push` hook whose entry is the
script; `README.md` names it; a workflow under `.github/workflows`, `.forgejo/workflows`
or `.gitea/workflows` runs it. Each is a named check with what was found instead.

e. **Coverage is never a gate.** A `thresholds:` block in a vitest config, a
`--cov-fail-under` or a `fail_under` anywhere, fails by file name (ADR 0012).

f. **Every wrapper with a narrow test has a contract list.** For every
`infrastructure/<name>.integration.test.ts` a `<name>Contract.ts` sits beside it, the
name compared without case and without a `-suffix`, so `websocket-fastify` finds
`webSocketContract`. Python repositories are not judged here until card 39 of the gate
plan gives them the convention.

g. **The command reports.** `ekohacks gate check` prints one line per check, pass or fail
with the reason, and exits 0 only when everything passes. The shell reads the files that
matter and `git ls-files`; the policy judges.

## Done when

- Run inside the observatory at its last commit before the gate script, it fails: no gate
  script, and a hook that runs `npm run test:changed`.
- Run inside the observatory, ekolite and propi-o today, it exits 0.
- Run inside this repository it names what this repository still owes the contract.
- Every behaviour is pinned against file contents; no mocks, no spies, nothing executed.

## Not in this story

Timing the gate against its ten-second budget (that needs a run; the ekolite CI already
records timings). Judging the red-tests-on-`main` rule, which no file states. The Python
contract-list convention. Wiring the check into each repository's CI, which is each
repository's own pull request once the check is boring.
