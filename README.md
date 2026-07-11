<div align="center">

# gstate

**Branch-aware, repository-local state for Git workflows.**

</div>

`gstate` stores small named values in Git configuration instead of tracked files. Use repository values as shared defaults, then override them for the branch you are working on.

```text
repository: editor=vim, theme=dark
branch:     editor=code
resolved:   editor=code, theme=dark
```

## Features

- **Branch-aware reads** — branch values override repository defaults.
- **Shared worktree state** — stores data in the Git common directory, so linked worktrees see the same repository and branch state.
- **No tracked files** — state stays in Git configuration.
- **Shell-friendly** — missing reads and idempotent branch deletes are silent successful no-ops.
- **Bun-native CLI** — install locally with `bun link`.

## Prerequisites

- [Bun](https://bun.sh/)
- [Git](https://git-scm.com/) repository

## Install

From this repository checkout:

```sh
bun install
bun link
```

`gstate` is now available on your PATH. To run it without linking:

```sh
bun ./index.ts <command>
```

> [!NOTE]
> This package is private. `bun link` is the supported installation path; it is not published to a package registry.

## Quick start

Run these commands inside a Git worktree:

```sh
# Set a repository-wide default.
gstate set editor vim --repo

# Override it only on the current branch.
gstate set editor code

# Read the effective value: "code".
gstate get editor

# Show effective state and where each value came from.
gstate list
# editor code (branch)

# Remove the branch override; the repository default is visible again.
gstate unset editor
gstate get editor
# vim
```

## Commands

```text
gstate <command> [args] [--repo]
```

| Command | Default scope | Description |
|---|---|---|
| `get <key>` | Resolved | Prints branch value first, then falls back to repository value. Missing keys print nothing and exit `0`. |
| `set <key> <value>` | Branch | Stores a value. Use `--repo` for a repository default. |
| `unset <key>` | Branch | Removes one value. Missing branch values are silent no-ops. |
| `list` | Resolved | Lists effective values with `(branch)` or `(repo)` origin. `list --repo` lists repository values only. |
| `list-all` | Both | Lists raw repository and current-branch values, including shadowed keys. |
| `rm` | Branch | Removes every value in the selected scope. Use `rm --repo` for repository values. |
| `rename <new-branch>` | Branch | Moves current branch state to another branch name; does not rename the Git branch. |

`--repo` is the only scope flag. Branch scope is the default for mutations.

## Scopes and storage

All state lives in the repository's shared Git configuration (`git rev-parse --git-common-dir`):

| Scope | Git configuration namespace | Availability |
|---|---|---|
| Repository | `state.repo.<key>` | Every branch and linked worktree |
| Branch | `state.<branch>.<key>` | That branch across linked worktrees |

An unscoped read resolves branch state before repository state. Repository-scoped commands work in detached HEAD. Branch-scoped commands require a checked-out branch unless `GIT_STATE_BRANCH` supplies one.

```sh
# Inspect or update branch state while detached.
GIT_STATE_BRANCH=feature/refactor gstate get editor
GIT_STATE_BRANCH=feature/refactor gstate set editor code
```

> [!WARNING]
> A branch named `repo` intentionally shares the `state.repo.*` namespace with repository scope. Avoid that branch name if the scopes must remain distinct.

## Keys and values

Keys follow Git configuration variable-name components. Use letters, digits, and hyphens; separate components with dots:

```sh
gstate set editor.theme dark
gstate set build-target arm64 --repo
```

Values are strings. Quote values containing spaces or shell-special characters:

```sh
gstate set review-note "needs API approval"
```

## Development

```sh
# Run the integration suite against temporary Git repositories.
bun test

# Type-check.
bunx tsc --noEmit
```

Tests exercise the CLI through real Git repositories, including scope precedence, detached repository operations, and branch-name regex isolation.
