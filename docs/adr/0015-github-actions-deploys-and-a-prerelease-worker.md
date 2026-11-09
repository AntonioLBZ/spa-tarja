# ADR-0015: GitHub Actions deploys, and a prerelease Worker for branches

- Status: Accepted
- Date: 2026-11-09

## Context

[ADR-0002](0002-solo-project-deployed-from-main.md) has GitHub Actions apply the migrations and deploy after CI, and allows no branches. The owner wants to try unreleased work on a phone before it reaches `main`, which it does not allow, and tried at the same time to move the deploy to Cloudflare, where the repository is connected (Workers Builds).

What stays: free tiers only ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)), and migrations reach production before the code ([ADR-0004](0004-data-conventions.md)). What shapes the prerelease: Google matches a redirect URI exactly and accepts no wildcard, so the prerelease needs one fixed address; and the repository is public.

Tried on 2026-11-09, so the decision rests on what was seen:

- The prerelease environment builds and deploys from the same repository, `d1` commands with `--env` reach the right database, migrations run fine after the build, and a host one level under `albz.app` is served at once with the free certificate.
- Workers Builds deployed `main` to production, and its image ran Node 26 and pnpm 12. It also ran the prerelease script for a branch, but a Git connection belongs to one Worker and the build forces that Worker's name: deploying `tarja-prerelease` from the connection of `tarja` stopped at the check of wrangler, `The name in your wrangler.json file (tarja) must match the name of your Worker`, before anything was deployed. A second connection for the prerelease Worker would not meet that check, but it is a second configuration in the dashboard, and the wrangler login is refused (`Forbidden`) by the API of the build logs, which can only be downloaded from the dashboard.

## Decision

- **GitHub Actions deploys production.** A push to `main` runs the checks and, when they pass, applies the migrations and deploys (`pnpm db:migrate:remote`, then `pnpm deploy:prod`). The migrations go first and a failed one stops the deploy. The Worker has no Git connection in Cloudflare, so nothing else deploys it.
- **Work stays on `main`, and a commit there is a release.** A branch is only a throwaway to try something on a phone: any branch other than `main` pushed to the repository deploys to the prerelease, replacing whatever was there, without waiting for checks so that work in progress can be tried. There are no pull requests as a way of working. That workflow runs on pushes only, and GitHub gives no secret to a workflow that a fork starts.
- **The prerelease is a second Worker**, `tarja-prerelease`, the `prerelease` environment of `wrangler.jsonc`, at `https://tarja-prerelease.albz.app`. It has its own D1 database, `tarja-prerelease`, its own secrets (a `BETTER_AUTH_SECRET` of its own) and its own Google OAuth client, in the same Google project, which lists only that address. It shares no data, secret or client with production.
- **One script deploys it**, `pnpm deploy:prerelease`: it builds with `CLOUDFLARE_ENV=prerelease`, applies the migrations with `--env prerelease` and deploys with `--env prerelease`. The workflow runs one deploy at a time and the newest push goes next.
- **Tests fail if the prerelease binds the production database**, or if its workflow can reach production (it runs the production scripts, or a pull request can start it).
- **The prerelease says what it is**: the build knows it is one, so the logo reads `Tarja-pre`, and the installed name (`Tarja Pre`), the page title and the icon (its line red) differ from production's. It needs no request and shows offline.

## Consequences

- A commit on `main` is a release, and one whose checks fail is not deployed.
- The output of a normal build binds the production database, so `wrangler deploy --env prerelease` over it would point the prerelease at production data (seen). That is why one script does both steps, and why the tests exist. Never run that deploy by hand after a normal build.
- Branches share one prerelease database. It is disposable: two branches with different migrations can collide, and then it is wiped.
- The prerelease is open. Nothing links its address and its data are the owner's tests. Cloudflare Access (free up to 50 users) could be put in front; it is left out for now because it is not confirmed to need no payment method, and free tiers only is a rule ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)).
- Two repository secrets, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, serve both deploys. The token writes Workers and D1 (it needs D1 Edit, Workers Scripts Edit and Workers Routes Edit, for the custom domain of the prerelease). Only a push to the repository starts a job that holds them, and a push needs write access to it; the job that runs on pull requests holds none.
- Both apps can sit on one phone: the prerelease is `Tarja Pre`, with a red line in its icon.
- [ADR-0003](0003-spa-on-one-worker-on-free-tiers.md) holds for production, one Worker and one D1. The prerelease is a second of each: the account holds two of the ten databases the free plan allows. GitHub Actions is free for a public repository.
- The logs are in the repository's Actions, where the owner and Claude can read them.

## Alternatives considered

- **Cloudflare Workers Builds deploying production and the prerelease**: tried (see Context). It deploys production well, with no tests in front of it, but one connection deploys one Worker, so the prerelease needs a second connection to configure by hand, and its logs can't be read with wrangler. Dropped for one place that deploys everything.
- **Worker Previews** (`wrangler preview`, same Worker): tried, and it works, but it is in open beta and the address is a name plus a random word chosen by Cloudflare when the Preview is created, so it changes if the Preview is recreated, and each change is a hand edit in Google's console.
- **Better Auth's OAuth proxy plugin** to sign previews in through production's callback: it needs a secret shared with production, and whoever holds it can assert identities to production; production's auth code would change too.
- **The same Google client with one more redirect URI**, or **a separate Google project in testing mode**: a second client in the project already in use gives the prerelease its own secret and keeps a problem with it away from production's sign-in, at little cost.
- **Only a branch named `prerelease` deploys**: the owner chose any branch.
