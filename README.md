# ekohacks

The EkoHacks CLI: our everyday operations, automated one small command at a time.

We run a distributed team shipping open source to npm with strict TDD and trunk based development. Every operation we repeat by hand gets written down first, run by hand until it is boring, and then encoded here. The first one is releasing: the manual process lives in [EkoLite's RELEASING.md](https://github.com/ekohacks/ekolite/blob/main/RELEASING.md), and `ekohacks release` is that document as a command.

## Status

The release command is built: the four stories in [`stories/`](stories/) are implemented, each delivered red first — a failing test is committed and reviewed before any production code exists. The suite is the specification. The acceptance test for the whole is the next real EkoLite release, run with `ekohacks release <version>`.

## How this is built

- A tested core policy behind nullable infrastructure, in the style of [James Shore's Testing Without Mocks](https://www.jamesshore.com/v2/projects/nullables): real wrappers around `git`, `gh` and `npm`, each with a `createNull()` that answers with configurable responses and records what was asked of it. No mocks, no spies.
- The CLI layer stays thin. Everything worth testing lives below it.
- TypeScript on Node 24, tests with Vitest, nothing bundled.
