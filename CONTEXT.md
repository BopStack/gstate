# Git State

Git State is branch-aware, repository-local metadata stored in Git configuration so command-line workflows can retain small named values without adding tracked files.

## Language

**State value**:
A named string stored by gstate for a repository scope or a branch scope.
_Avoid_: setting, config value

**Repository scope**:
State shared by every worktree in one Git repository and available without a checked-out branch.
_Avoid_: global state, worktree state

**Branch scope**:
State associated with one Git branch and shared by every worktree of its repository. It overrides a same-named repository-scoped state value during an unscoped read.
_Avoid_: local state, checkout state

**Resolved state**:
The effective state value selected by branch-over-repository precedence, together with the scope that supplied it.
_Avoid_: merged state, inherited state
