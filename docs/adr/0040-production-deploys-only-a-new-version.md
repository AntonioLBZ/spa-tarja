# ADR-0040: Production deploys only a new version

- Status: Accepted
- Date: 2026-11-21

## Context

[ADR-0015](0015-github-actions-deploys-and-a-prerelease-worker.md) deploys every push to `main` that passes the checks: a commit on `main` is a release. The number of the app moves apart, in a commit of its own (`chore: release x.y.z`), when the owner asks, so production runs code that no version names, and a push of docs or a half finished set of commits reaches the people using the app as soon as it lands.

The owner wants production to change only when they say a version is ready, wants the same rule in their other projects, and works alone: no pull requests, no labels, no version pull request made by a bot.

## Decision

- **A push to `main` deploys production only when its version is new**: when no GitHub Release `vX.Y.Z` exists yet for the `version` of `package.json`. The job `version` of `ci.yml` asks that after the checks pass, and the job `release` (migrations, then the deploy) and the job `tag` (the release and its tag) run only when it answers that the version is new.
- **Any other push to `main` deploys nothing.** It runs the checks, and that is all. It never deploys the prerelease: the prerelease is for branches, as [ADR-0015](0015-github-actions-deploys-and-a-prerelease-worker.md) says.
- **Releasing stays one commit**, `chore: release x.y.z`, which the owner asks for, pushed to `main`. The question is whether the release exists, not whether the last commit changed the number, so it holds when that commit is pushed together with others, and in any order among them.
- Everything else of [ADR-0015](0015-github-actions-deploys-and-a-prerelease-worker.md) stands: GitHub Actions deploys, migrations go first, branches deploy the prerelease, the Worker has no Git connection.

## Consequences

- Production runs exactly the code of a version, and the version the Settings show is always the one deployed.
- A fix reaches production only with a patch release (`chore: release 1.5.2`).
- Unreleased commits on `main` are seen nowhere but on a laptop. To try them on a phone, push them to a branch first.
- A release whose deploy fails creates no GitHub Release, so the next push to `main` finds the version still new and deploys again. A failed migration stops the deploy, as before.
- Migrations reach production only with a release. They still go before the code, so the rule of [ADR-0004](0004-data-conventions.md) (add, never rename or drop) is unchanged.
- A push of docs alone no longer redeploys the same files.

## Alternatives considered

- **Deploy when the last commit changed the `version`**: misses a release commit pushed under later ones, and redeploys when a release is reverted.
- **Deploy on a pushed tag**: a second thing to push by hand on every release, and the tag would exist before the deploy has worked.
- **Unreleased commits on `main` deploy the prerelease**: the owner keeps `main` out of the prerelease.
- **A tool that versions through a pull request (Changesets, labels for the bump)**: tried in another project of the owner's; for one person it is a pull request, a label and a bot's merge per release, plus a GitHub App so that the bot's pushes start the checks.
