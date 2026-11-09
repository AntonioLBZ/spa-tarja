# ADR-0015: Cloudflare deploys, and a prerelease Worker for branches

- Status: Accepted
- Date: 2026-11-09

## Context

[ADR-0002](0002-solo-project-deployed-from-main.md) has GitHub Actions apply the migrations and deploy after CI. The owner wants the deploy in Cloudflare, where the repository is already connected (Workers Builds) with builds disabled, and wants to try unreleased work on a phone before it reaches `main`, which ADR-0002 does not allow.

What stays: free tiers only ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)), and migrations reach production before the code ([ADR-0004](0004-data-conventions.md)). What shapes the prerelease: Google matches a redirect URI exactly and accepts no wildcard, so the prerelease needs one fixed address; and the repository is public.

Tried on a throwaway Worker on 2026-11-09, so the decision rests on what was seen: the prerelease environment builds and deploys from the same repository, `d1` commands with `--env` reach the right database, migrations run fine after the build, and a host one level under `albz.app` is served at once with the free certificate.

## Decision

- **Cloudflare deploys production.** A push to `main` is built with `pnpm run build` and deployed with `pnpm db:migrate:remote && npx wrangler deploy`: the migrations go first and a failed one stops the deploy. No tests stand in front of it, so a push whose checks fail is still deployed; they run in the husky hook and in CI. GitHub Actions only checks, on a push to `main` and on a pull request, and holds no Cloudflare secret.
- **Work stays on `main`, and a commit there is a release.** A branch is only a throwaway to try something on a phone: any branch other than `main` pushed to the repository deploys to the prerelease, replacing whatever was there. There are no pull requests as a way of working.
- **The prerelease is a second Worker**, `tarja-prerelease`, the `prerelease` environment of `wrangler.jsonc`, at `https://tarja-prerelease.albz.app`. It has its own D1 database, `tarja-prerelease`, its own secrets (a `BETTER_AUTH_SECRET` of its own) and its own Google OAuth client, in the same Google project, which lists only that address. It shares no data, secret or client with production.
- **One script deploys it**, `pnpm deploy:prerelease`: it builds with `CLOUDFLARE_ENV=prerelease`, applies the migrations with `--env prerelease` and deploys with `--env prerelease`. It is the deploy command Workers Builds runs for a branch other than `main`.
- **A test fails if the prerelease binds the production database.**
- **The prerelease says what it is**: the app built for it shows a mark. The build knows, so it needs no request and shows offline.

## Consequences

- The output of a normal build binds the production database, so `wrangler deploy --env prerelease` over it would point the prerelease at production data (seen). That is why one script does both steps, and why the test exists. Never run that deploy by hand after a normal build.
- Branches share one prerelease database. It is disposable: two branches with different migrations can collide, and then it is wiped.
- The prerelease is open. Nothing links its address and its data are the owner's tests. Cloudflare Access (free up to 50 users) could be put in front; it is left out for now because it is not confirmed to need no payment method, and free tiers only is a rule ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)).
- The repository is public and the build token writes Workers and D1. Before builds for other branches are on, the owner checks in the Cloudflare dashboard that pull requests from forks are not built. If that cannot be ensured, branch builds stay off and the prerelease is deployed by hand with the same script.
- Both apps install as "Tarja"; only the mark tells them apart.
- [ADR-0003](0003-spa-on-one-worker-on-free-tiers.md) holds for production, one Worker and one D1. The prerelease is a second of each, within the free limits. Builds draw on the 3,000 free build minutes a month, and the free plan runs one build at a time, so two deploys never overlap.
- Not tried here, only in Workers Builds itself: whether its image installs Node 26 (CI uses 26; the image defaults to 24), the check that the config's `name` matches the Worker, whether the build token may create the custom domain, and the rule for pull requests from forks.

## Alternatives considered

- **Worker Previews** (`wrangler preview`, same Worker): tried, and it works, but it is in open beta and the address is a name plus a random word chosen by Cloudflare when the Preview is created, so it changes if the Preview is recreated, and each change is a hand edit in Google's console.
- **Better Auth's OAuth proxy plugin** to sign previews in through production's callback: it needs a secret shared with production, and whoever holds it can assert identities to production; production's auth code would change too.
- **The same Google client with one more redirect URI**, or **a separate Google project in testing mode**: a second client in the project already in use gives the prerelease its own secret and keeps a problem with it away from production's sign-in, at little cost.
- **Keep GitHub Actions deploying and add a prerelease job**: the owner wants Cloudflare to deploy.
- **Only a branch named `prerelease` deploys**: the owner chose any branch.
