# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- After the first deploy, check the headers on the root, on a deep link and on the API, with GET, since the static headers file is not exercised by the tests: `for p in / /join/x /groups /favicon.svg /api/health; do curl -sS -o /dev/null -D - "https://<the app address>$p" | grep -iE 'content-security|x-frame|referrer-policy'; done`. All five must print all three headers (`frame-ancestors`, `X-Frame-Options` and `Referrer-Policy`). If the single-page fallback lacks them, `frame-ancestors` cannot be set by a `<meta>` tag: decide then.
- **Before the merge, in the dashboards and on production:**
    1. What one Workers Logs entry holds (the `cookie` header, the IP, `x-tarja-user`, the location): open one of `PUT /api/expenses/<id>` and one of `GET /api/auth/callback/google`. If the cookie shows, turn the invocation logs off (`"observability": { "enabled": true, "logs": { "invocation_logs": false } }`).
    2. That the IP reaches the session row in production, after signing in: `pnpm wrangler d1 execute tarja --remote --command "SELECT ipAddress, userAgent FROM session WHERE userId = '<id>' ORDER BY createdAt DESC LIMIT 1"`.
    3. The location and the jurisdiction of the D1 database (Dashboard, D1, tarja); the jurisdiction can only be set when a database is created.
    4. That no zone feature of the domain adds analytics, a tool loader or a bot cookie to `tarja.albz.app` (Web Analytics automatic setup, Zaraz, the bot mode that sets `__cf_bm`).
    5. That the `account` rows hold no tokens and `user.image` is empty right after migration `0013` has run in production, and still so after the next sign-in: `SELECT providerId, idToken IS NOT NULL AS id_token, accessToken IS NOT NULL AS access_token, refreshToken IS NOT NULL AS refresh_token FROM account WHERE userId = '<id>'` and `SELECT image FROM "user" WHERE id = '<id>'`.
    6. An account deletion from start to end in production with a second Google account: make a group with a dummy, add that account as a friend in the dummy's place, delete it, then look for its email and the old dummy name in `user`, `session`, `account`, `profile`, `expenses` and `shared_members`.
    7. The rows of the old fixed user (`docs/specs/authentication.md`) that nobody can reach: delete them if they hold nothing worth keeping.
    8. The Google consent screen (Google Cloud console): publishing status, app name and support email.
- Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **The same component, another variant.** Not answered yet: the row of actions copied in `category-row`, `expense-row`, `expense-form` and `dialog` (a component or leave it), and the titles and hints repeated in eight CSS files (`:where(h1)` and `:where(h2)` in `base.css`, or leave them).
- **Stories of the groups.** None yet for Settle up, the Leave and Delete panels, the steps of a person, `InvitationLink` or `InviteFriend`; the ledger row has one (`Features/LedgerRow`).
- **`:focus-visible` of the rest.** The ring of `ChoiceGroup`, `Select` and the `Dialog` is done. What is left is the global one, on buttons, links and fields: with the gray accent it sits next to the ink edge and may be hard to tell apart, which only the owner's eye can say. A throwaway story that forces the focus on each component, to look at every accent in light and dark, would settle it.

## 18. Cloudflare deploys, and a prerelease Worker

Decided in [ADR-0015](docs/adr/0015-cloudflare-deploys-and-a-prerelease-worker.md). The docs are written; the code is not. The repo is already connected to Cloudflare with builds disabled (_Disable builds_), so GitHub Actions keeps deploying until this is done. **Never leave both on:** Cloudflare would publish the code before the migrations are applied. The order: the owner's steps 1 to 4 with builds off, then the repo side into `main`, then step 5, then a branch, then steps 6 and 7.

The owner, in the Cloudflare and Google dashboards:

1. Add **Account → D1 → Edit** to the Workers Builds token; by default it has no D1 permission and the remote migrations would fail.
2. Create the D1 database `tarja-prerelease` (`pnpm wrangler d1 create tarja-prerelease`); its id goes into `env.prerelease`.
3. In Google Cloud, in the project already in use, make a second OAuth client (web application) whose only redirect URI is `https://tarja-prerelease.albz.app/api/auth/callback/google`.
4. Check that Workers Builds does not build pull requests from forks (the repository is public and the token writes Workers and D1). If that cannot be ensured, builds for other branches stay off.
5. Once the repo side is in `main`: build command `pnpm run build`, deploy command `pnpm db:migrate:remote && npx wrangler deploy`, builds for branches other than `main` on with the deploy command `pnpm deploy:prerelease`. Then turn builds on and look at the first production deploy.
6. After the first deploy of the prerelease, its three secrets: `pnpm wrangler secret put BETTER_AUTH_SECRET --env prerelease` (a new random value), and `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` of the second client.
7. After the first Cloudflare deploy of production works, delete the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The repo side:

- `wrangler.jsonc`: `env.prerelease` with `workers_dev` off, the custom-domain route `tarja-prerelease.albz.app` and the D1 database `tarja-prerelease`; then `pnpm types:gen`.
- `package.json`: `db:migrate:prerelease` and `deploy:prerelease` (build with `CLOUDFLARE_ENV=prerelease`, migrate with `--env prerelease`, deploy with `--env prerelease`). `deploy:prod` stays as the fallback by hand.
- The test that fails if `env.prerelease` binds production's database ([testing and CI](docs/specs/testing-and-ci.md)).
- `.nvmrc` with `26`; if Workers Builds does not install it, `24` in `.nvmrc` and in `ci.yml`.
- Remove the `release` job from `.github/workflows/ci.yml`.
- The prerelease mark ([header](docs/specs/header.md)): the build reads `CLOUDFLARE_ENV` (a `define` in `vite.config.ts`), a component, and `prerelease.mark` in both locales. Where it sits and how it looks is for the owner to settle ([`DESIGN.md`](design-system/DESIGN.md#8-open-questions)).
- Check the free-plan limits for a second Worker and a second D1 database ([ADR-0003](docs/adr/0003-spa-on-one-worker-on-free-tiers.md)); three databases existed at once while it was tried.
- Not tried outside Workers Builds, so watch the first builds: whether the image installs Node 26, the check that the config's `name` matches the Worker, whether the token may create the custom domain, and the rule for forks.
