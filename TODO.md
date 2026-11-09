# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the layout on a real iOS Safari: safe areas, keyboard, install, the Undo toast, that the JSON and the CSV files download from the installed app, the Dot Matrix logo in the header and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches). Android Chrome, the installed app and the web, was seen by the owner and is right. The colors wait for a review with the owner, and so do the Dot Matrix logo and whether categories keep a color of their own ([DESIGN.md §8](design-system/DESIGN.md#8-open-questions)).
- Check the bottom bar of the shared expenses branch on a real phone (iOS Safari and Android Chrome): that it comes back after the back button of Android closes the keyboard (it hides while a field has the focus, not while the keyboard is open; if it stays out, hide it only while `visualViewport` is shorter than the window), the update toast above it, the landscape safe areas, English and a color other than gray, and whether a tab needs a pressed state (it has none).
- After the first deploy, check the headers on the root, on a deep link and on the API, with GET, since the static headers file is not exercised by the tests: `for p in / /join/x /groups /favicon.svg /api/health; do curl -sS -o /dev/null -D - "https://<the app address>$p" | grep -iE 'content-security|x-frame|referrer-policy'; done`. All five must print all three headers (`frame-ancestors`, `X-Frame-Options` and `Referrer-Policy`). If the single-page fallback lacks them, `frame-ancestors` cannot be set by a `<meta>` tag: decide then.
- **Before the merge, in the dashboards and on production:**
    1. What one Workers Logs entry holds (the `cookie` header, the IP, `x-tarja-user`, the location): open one of `PUT /api/expenses/<id>` and one of `GET /api/auth/callback/google`. If the cookie shows, turn the invocation logs off (`"observability": { "enabled": true, "logs": { "invocation_logs": false } }`).
    2. That the IP reaches the session row in production, after signing in: `pnpm wrangler d1 execute tarja --remote --command "SELECT ipAddress, userAgent FROM session WHERE userId = '<id>' ORDER BY createdAt DESC LIMIT 1"`.
    3. The location and the jurisdiction of the D1 database (Dashboard, D1, tarja); the jurisdiction can only be set when a database is created.
    4. That no zone feature of the domain adds analytics, a tool loader or a bot cookie to `tarja.albz.app` (Web Analytics automatic setup, Zaraz, the bot mode that sets `__cf_bm`).
    5. That the `account` rows hold no tokens and `user.image` is empty right after migration `0013` has run in production, and still so after the next sign-in: `SELECT providerId, idToken IS NOT NULL AS id_token, accessToken IS NOT NULL AS access_token, refreshToken IS NOT NULL AS refresh_token FROM account WHERE userId = '<id>'` and `SELECT image FROM "user" WHERE id = '<id>'`.
    6. An account deletion from start to end in production with a second Google account: make a group with a dummy, add that account as a friend in the dummy's place, delete it, then look for its email and the old dummy name in `user`, `session`, `account`, `profile`, `expenses` and `shared_members`.
    7. The run of the migrations on a copy of the production schema (item 31) must use `pnpm wrangler d1 export tarja --remote --no-data --output=schema.sql`, never a full export: it would put everybody's data on the laptop. Delete any full export that exists.
    8. The rows of the old fixed user (`docs/specs/authentication.md`) that nobody can reach: delete them if they hold nothing worth keeping.
    9. The Google consent screen (Google Cloud console): publishing status, app name and support email.
- **Review the shared expenses proposal** (pull request #1, branch `feat/shared-expenses`): ADR-0012 to ADR-0014 and the specs `groups`, `shared-expenses`, `balances`, `invitations` and `bottom-navigation` are written and `Proposed`. The owner answered (2026-11-01) and the specs follow: a group can be deleted or left only when settled; deleting a shared expense has Undo and no confirmation; simplified debts off by default; a settlement is at least one cent and may exceed the debt; turning off "Show in my expenses" takes the group out of the list and the totals; a person who left keeps the group read-only as it was the day they left, and a closed group can be archived; the payer of a shared expense may use a credit or restaurant card, and for the rest it is paid now; no several payers; invitations are links to be friends only, with a nickname your friends see and no lookup of people; groups hold dummies and friends, and adding a friend is immediate; deleting an account must be possible; the privacy notice must be written; the bottom bar is the first thing to build. Still open:
    1. **Review the default categories in a new conversation** (trips, treats and the like). Shared expenses use default categories only, so the set matters; nothing was added for now.
    2. **The privacy notice** is written; the owner has it read before the merge by someone who can judge it. The text is the keys `privacy.*` in `src/assets/locales/en.json` and `src/assets/locales/es.json`, opened from Settings and from the sign-in screen, with the contact in `src/lib/contact.ts` (`docs/specs/settings.md`). The periods it states (request logs at most 7 days, backups at most 30) are upper bounds that hold on the free and the paid plans. What the repository cannot show, so the owner confirms it: what one Workers Logs entry holds (`others.cloudflare` says "technical details of the connection" and changes if an entry holds more), the location of the D1 database (the sentence on transfers assumes it is unknown), and that Cloudflare's data processing terms apply to the account.
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

Sharing expenses with other people, on the branch `feat/shared-expenses` ([ADR-0012](docs/adr/0012-shared-expenses.md), [ADR-0013](docs/adr/0013-shared-entries-sync-through-an-outbox.md), [ADR-0014](docs/adr/0014-people-in-groups.md)). The numbers stay when an item is deleted (19, the bottom navigation, 20, the nickname, 21, the maths, 22, the groups on the server, 23, the groups on the device, 24, the screens of groups and friends, 25, sharing an expense, 26, friends by invitation, 27, shared expenses in your own lists, 28, simplified debts, 29, deleting the account, and 30, the privacy notice, are done). Each item gets its task plan when it starts, ends with `pnpm format:check`, `types:check`, `lint`, `test` and `build` green, updates the docs it touches in the same commits, and stays on the branch until the last item. Delete an item when it is done, as for the rest of this file.

### 31. Before the merge

A review of the whole branch by a separate reviewer on Opus 5.5, hunting functional and security failures (authorization on every group, friend, invitation, profile and account route, invitation tokens, account deletion, input validation, rounding, the outbox and `seq` races, leaks of the email or of other people's data), with every finding fixed test first. An accessibility and layout pass at 320 px in both languages and on a real phone (the totals and the notices of a ledger that failed to load have no `role`), the open questions of `DESIGN.md` §8 that the work raised, a run of the migrations on a copy of the production schema, `main` merged into the branch, the ADRs from `Proposed` to `Accepted`, the paragraph about the branch removed from `repository-structure.md`, and the owner's go-ahead. Then the pull request is merged with a merge commit (`gh pr merge --merge`).

- The budget warning compares with the copy on the device, as for a personal expense, so a shared add made before the entries of its group first reach the device is compared with none of them and can miss a limit; warning once the pull lands would settle both.
- Invitations (milestone 26b): making and revoking a link in a loop leaves a row for 30 days each (a revoked link is kept so that revoking it again answers 200) and the cap counts the open ones only; shielding the API from sheer load would be a rule for all of `/api/*` ([invitations](docs/specs/invitations.md)); the owner should see the Groups tab with links at 320 px in both languages.
