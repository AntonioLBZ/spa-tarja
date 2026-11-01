# ADR-0012: Shared expenses are built on a branch and merged once, with a merge commit

- Status: Proposed
- Date: 2026-11-01

## Context

[ADR-0002](0002-solo-project-deployed-from-main.md) puts every commit straight on `main`, and every push to `main` is a release. Shared expenses ([ADR-0013](0013-scope-shared-expenses-in.md)) are the biggest piece of work so far: new tables that reach production on the day of the release, a new navigation, and a change to how every list adds up. The owner wants none of it live until all of it is ready.

## Decision

- The work lives on the branch `feat/shared-expenses`, with one draft pull request to `main` opened before any code is written. Until the owner approves the specs in that pull request, only documents are written.
- Nothing from the branch reaches `main` before the owner says so. The whole feature goes out as one release: the migrations first, then the code, as [ADR-0002](0002-solo-project-deployed-from-main.md) already does for any push.
- The pull request is merged with a **merge commit**, never squashed or rebased, so every commit of the branch enters the history of `main`. Commits follow the usual rules: one conventional-commit subject line, no body, no trailers.
- `main` is merged into the branch whenever it moves, never the other way round and never a rebase, so the commits already pushed keep their hashes. A migration is numbered after the last one on `main` at that moment.
- CI runs its `check` job on the pull request. The `release` job runs only on a push to `main`.
- [ADR-0002](0002-solo-project-deployed-from-main.md) is not superseded: it holds for everything else, and this exception ends when the pull request is merged. If a small fix to `main` is needed meanwhile, it goes straight to `main` as usual and is merged into the branch.

## Consequences

- `AGENTS.md` names the exception, so an agent working on the branch doesn't read "no feature branches" as a mistake.
- The decisions of this work are `Proposed` until the owner approves the pull request. The last commit before the merge turns them to `Accepted`.
- While the branch lives, production doesn't change: the new tables are only created in the local D1 (`pnpm db:migrate`).
- A long branch drifts. The cost is paid by merging `main` into it often and by keeping each milestone green (`TODO.md`).

## Alternatives considered

- **Squash merge**: one commit on `main`, which the owner doesn't want: the commits tell how the feature was built.
- **Rebase merge**: keeps the commits but rewrites their hashes, and the branch would need a force push after every rebase.
- **Everything on `main` behind a flag**: the migrations and the code would be in production from the first commit, and a flag in every list and in the navigation would have to be removed afterwards.
