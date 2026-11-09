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
- **Shared expenses** (pull request #1): ADR-0012 to ADR-0014 are accepted and the specs hold the owner's answers of 2026-11-01. Still open:
    1. **Review the default categories in a new conversation** (trips, treats and the like). Shared expenses use default categories only, so the set matters; nothing was added for now.
    2. **The privacy notice** is written and was read by someone who can judge it (2026-11-09). The text is the keys `privacy.*` in `src/assets/locales/en.json` and `src/assets/locales/es.json`, opened from Settings and from the sign-in screen, with the contact in `src/lib/contact.ts` (`docs/specs/settings.md`). The periods it states (request logs at most 7 days, backups at most 30) are upper bounds that hold on the free and the paid plans. What the repository cannot show, so the owner confirms it: what one Workers Logs entry holds (`others.cloudflare` says "technical details of the connection" and changes if an entry holds more), the location of the D1 database (the sentence on transfers assumes it is unknown), and that Cloudflare's data processing terms apply to the account.
- Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **The same component, another variant.** Not answered yet: the row of actions copied in `category-row`, `expense-row`, `expense-form` and `dialog` (a component or leave it), and the titles and hints repeated in eight CSS files (`:where(h1)` and `:where(h2)` in `base.css`, or leave them).
- **Stories of the groups.** None yet for Settle up, the Leave and Delete panels, the steps of a person, `InvitationLink` or `InviteFriend`; the ledger row has one (`Features/LedgerRow`).
- **`:focus-visible` of the rest.** The ring of `ChoiceGroup`, `Select` and the `Dialog` is done. What is left is the global one, on buttons, links and fields: with the gray accent it sits next to the ink edge and may be hard to tell apart, which only the owner's eye can say. A throwaway story that forces the focus on each component, to look at every accent in light and dark, would settle it.

## 18. Move the production deploy from GitHub Actions to Cloudflare Workers Builds

Revisar pros y contras antes de nada.

The owner wants the deploy centralized in Cloudflare. The repo is already connected there with builds disabled (_Disable builds_), so GitHub Actions keeps deploying until this is done. Never leave both on: Cloudflare would publish the code before the migrations are applied ([ADR-0002](docs/adr/0002-solo-project-deployed-from-main.md)).

The owner, in the Cloudflare dashboard:

1. Add **Account → D1 → Edit** to the Workers Builds token; by default it has no D1 permission and the remote migrations would fail.
2. Build command `pnpm run build`. No tests there, like the owner's Vercel projects: they stay in the `check` job of GitHub Actions and in the husky hook, so a push with failing tests is still deployed.
3. Deploy command `pnpm db:migrate:remote && npx wrangler deploy`: the migrations go first and a failed one stops the deploy. `d1 migrations apply` does nothing when none is pending, so the "did `db/migrations` change" logic goes away.
4. Enable builds again once the repo side below is in `main`.

The repo side:

- Write the ADR that supersedes [ADR-0002](docs/adr/0002-solo-project-deployed-from-main.md), update `docs/specs/repository-structure.md` and `docs/specs/testing-and-ci.md`, then `AGENTS.md` (Commands and the secrets line): Cloudflare deploys, GitHub Actions only checks.
- Remove the `release` job from `.github/workflows/ci.yml`.
- Add a `.nvmrc` with `26` (today the Node version is pinned only in `ci.yml`), or set `NODE_VERSION` in Cloudflare; check that Workers Builds accepts it.
- Drop `deploy:prod` from `package.json` if nothing uses it, and delete the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` after the first Cloudflare deploy works.

A prerelease address for branches, to try the app on phones before it reaches `main` (analyze first whether it is possible and advisable, and say it in the same ADR, since ADR-0002 allows no branches today). The owner's idea: a branch of the repository itself (never a fork) deploys to its own address, such as `tarja.prerelease.albz.app`. What to settle:

- **One fixed address, not one per branch.** Google lists each origin and redirect URI by hand, with no wildcards, and a stream of new addresses is what could get the sign-in flagged or the client closed. The app takes its base address from each request, so any address works once Google lists it.
- **Google.** A separate client (or project) in testing status with the owner as the only test user keeps the consent screen of production out of reach; the same client with one more redirect URI is simpler, and only worth it if it is judged safe.
- **Its own data and secrets.** A second D1 database and its own `BETTER_AUTH_SECRET` (it signs the invitation links), so a branch with unreleased migrations never touches production data, and the migrations of a branch run on that database only.
- **Who may deploy.** Branches pushed to the repository by the owner; a pull request from a fork gets neither a deploy nor the secrets. Decide whether any branch deploys or only named ones; the last one pushed replaces the one before.
- **Free tiers.** A second Worker and a second D1 database count against the limits of [ADR-0003](docs/adr/0003-spa-on-one-worker-on-free-tiers.md); check them.
- **Looks like what it is.** A mark in the page that says it is a prerelease, and no indexing by search engines.

## Shared expenses

Sharing expenses with other people ([ADR-0012](docs/adr/0012-shared-expenses.md), [ADR-0013](docs/adr/0013-shared-entries-sync-through-an-outbox.md), [ADR-0014](docs/adr/0014-people-in-groups.md)). The numbers stay when an item is deleted (19, the bottom navigation, 20, the nickname, 21, the maths, 22, the groups on the server, 23, the groups on the device, 24, the screens of groups and friends, 25, sharing an expense, 26, friends by invitation, 27, shared expenses in your own lists, 28, simplified debts, 29, deleting the account, and 30, the privacy notice, are done). Delete an item when it is done, as for the rest of this file.

### 31. Before the merge

What is left before the pull request is merged, all of it the owner's: the answer to the open question of `DESIGN.md` §8 that the work raised (the bottom bar and the shared screens). The check on a real phone and the reading of the privacy notice are done. The migrations 0010 to 0013 were run on a copy of the production schema (no data, 2026-11-09): the schema of production is the one of 0001 to 0009, the four apply in order over rows of every older table with no error and no foreign key broken, and they end in the schema of a fresh database; production has exactly those four pending. Never take a full export of the production database for such a run: it would put everybody's data on the laptop. The review of the whole branch by a separate reviewer on Opus 5.5 is done, with every finding fixed test first, and so are the ADRs (`Accepted`) and the removal of the paragraph about the branch. If `main` moves, it is merged into the branch (never a rebase). Then the owner makes the pull request ready and merges it with a merge commit (`gh pr ready 1`, `gh pr merge 1 --merge`); with the merge `workers.dev` goes off and the four migrations go out together.

- The budget warning compares with the copy on the device, as for a personal expense, so a shared add made before the entries of its group first reach the device is compared with none of them and can miss a limit; warning once the pull lands would settle both.
- Invitations (milestone 26b): making and revoking a link in a loop leaves a row for 30 days each (a revoked link is kept so that revoking it again answers 200) and the cap counts the open ones only; shielding the API from sheer load would be a rule for all of `/api/*` ([invitations](docs/specs/invitations.md)); the owner should see the Groups tab with links at 320 px in both languages.
