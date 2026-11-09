# ADR-0002: Work on `main`, and deploy every push that passes CI

- Status: Superseded by ADR-0015
- Date: 2026-10-25

## Context

Migrations have to reach production before the code that needs them ([ADR-0004](0004-data-conventions.md)).

## Decision

- No feature branches and no pull requests: the owner is the only developer, and commits go straight to `main`.
- Every push to `main` that passes CI is deployed to production, after applying the migrations. A failed migration stops the deploy.

## Consequences

- A commit on `main` is a release.
- How the deploy runs (the baseline for the migrations, the secrets, doing it by hand) is in [testing and CI](../specs/testing-and-ci.md) and [repository structure](../specs/repository-structure.md).
- [ADR-0015](0015-github-actions-deploys-and-a-prerelease-worker.md) supersedes this ADR: it allows a branch, to try work on a phone in a prerelease. Production is still deployed from `main` by GitHub Actions.
