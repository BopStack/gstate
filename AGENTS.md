# Agent Instructions

## Package Manager
- Use Bun: `bun install`.
- Do not introduce Node.js-specific runners or package managers.

## Commands
| Task | Command |
|---|---|
| Test one file | `bun test src/git_state.test.ts` |
| Test all | `bun test` |
| Type-check | `bunx tsc --noEmit` |
| Run CLI locally | `bun ./index.ts <command>` |
| Link CLI locally | `bun link` |

## Key Conventions
- Keep executable startup in `index.ts`; keep CLI behavior in `src/git_state.ts`.
- Colocate Bun integration tests with the implementation as `src/*.test.ts`.
- Use real temporary Git repositories for CLI behavior tests; do not mock Git config.
- Use Bun APIs and named TypeScript exports.
- Keep branch state in `state.<branch>.<key>` and repository state in `state.repo.<key>`.
- Branch state overrides repository state for unscoped reads.
- `--repo` selects repository scope; branch scope is the default for mutations.

## External References
| Need | File |
|---|---|
| CLI domain language | `CONTEXT.md` |
| Basic setup and invocation | `README.md` |
