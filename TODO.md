# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the layout on a real iOS Safari: safe areas, keyboard, install, the Undo toast, that the JSON and the CSV files download from the installed app, the Dot Matrix logo in the header and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches). Android Chrome, the installed app and the web, was seen by the owner and is right. The colors wait for a review with the owner, and so do the Dot Matrix logo and whether categories keep a color of their own ([DESIGN.md §8](design-system/DESIGN.md#8-open-questions)).
- Check the bottom bar of the shared expenses branch on a real phone (iOS Safari and Android Chrome): that it comes back after the back button of Android closes the keyboard (it hides while a field has the focus, not while the keyboard is open; if it stays out, hide it only while `visualViewport` is shorter than the window), the update toast above it, the landscape safe areas, English and a color other than gray, and whether a tab needs a pressed state (it has none).
- Retire the notice that the app moved once nobody opens the old address: `AppMoved` (`features/pwa`), `src/lib/address.ts` and its strings in the locales go, and `"workers_dev"` in `wrangler.jsonc` turns to `false` so the old address stops answering. `Dialog` stays.
- **Review the shared expenses proposal** (pull request #1, branch `feat/shared-expenses`): ADR-0012 to ADR-0014 and the specs `groups`, `shared-expenses`, `balances`, `invitations` and `bottom-navigation` are written and `Proposed`. The owner answered (2026-11-01) and the specs follow: a group can be deleted or left only when settled; deleting a shared expense has Undo and no confirmation; simplified debts off by default; a settlement is at least one cent and may exceed the debt; turning off "Show in my expenses" takes the group out of the list and the totals; a person who left keeps the group read-only as it was the day they left, and a closed group can be archived; the payer of a shared expense may use a credit or restaurant card, and for the rest it is paid now; no several payers; invitations are links to be friends only, with a nickname your friends see and no lookup of people; groups hold dummies and friends, and adding a friend is immediate; deleting an account must be possible; the privacy notice must be written; the bottom bar is the first thing to build. Still open:
    1. **Review the default categories in a new conversation** (trips, treats and the like). Shared expenses use default categories only, so the set matters; nothing was added for now.
    2. **The privacy notice** carries the contact of the portfolio (`docs/specs/settings.md`); the owner has it read by someone who can judge it before the merge (item 30).
- Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **The same component, another variant.** Not answered yet: the row of actions copied in `category-row`, `expense-row`, `expense-form` and `dialog` (a component or leave it), and the titles and hints repeated in eight CSS files (`:where(h1)` and `:where(h2)` in `base.css`, or leave them).
- **Stories of the groups.** None yet for Settle up, the Leave and Delete panels or the steps of a person; the ledger row has one (`Features/LedgerRow`).
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

## Shared expenses

Sharing expenses with other people, on the branch `feat/shared-expenses` ([ADR-0012](docs/adr/0012-shared-expenses.md), [ADR-0013](docs/adr/0013-shared-entries-sync-through-an-outbox.md), [ADR-0014](docs/adr/0014-people-in-groups.md)). The numbers stay when an item is deleted (19, the bottom navigation, 20, the nickname, 21, the maths, 22, the groups on the server, 23, the groups on the device, 24, the screens of groups and friends, 25, sharing an expense, 26, friends by invitation, 27, shared expenses in your own lists, and 28, simplified debts, are done). Each item gets its task plan when it starts, ends with `pnpm format:check`, `types:check`, `lint`, `test` and `build` green, updates the docs it touches in the same commits, and stays on the branch until the last item. Delete an item when it is done, as for the rest of this file.

### 29. Delete the account

`DELETE /api/account` and the dialog in the settings ([authentication](docs/specs/authentication.md), [settings](docs/specs/settings.md)), tested against a user with expenses, groups they own, groups they are in, open invitations and balances. A user deleted while their session cache is still valid (up to 5 minutes) must get `401` from the profile routes, with a test: today `PUT /api/profile` answers `500` on the foreign key and `readProfile` throws a plain error, which making a group and adding a friend also call. What the tables of groups need from it, in its one batch: blank `shared_members.name` (and close the user's friends and hand over or close the groups they own, or a row keeps `role = 'owner'` with no user) before the `user` row is deleted, since `ON DELETE SET NULL` clears `user_id` then and the user's members can no longer be found; the indexes on `created_by` and `updated_by` keep that `SET NULL` from reading every row.

- `/invitations/read` and `/accept` call `readProfile` for the inviter and the caller, which throws a plain error (500) when the user is gone: add them to the 401 test of the profile routes.

### 30. The privacy notice

The `Dialog` with the notice, in `en` and `es`, from the settings and from the sign-in screen ([settings](docs/specs/settings.md), [authentication](docs/specs/authentication.md)). It carries the contact of the owner, and needs a read by someone who can judge it before the merge.

### 31. Before the merge

A review of the whole branch by a separate reviewer on Opus 5.5, hunting functional and security failures (authorization on every group, friend, invitation, profile and account route, invitation tokens, account deletion, input validation, rounding, the outbox and `seq` races, leaks of the email or of other people's data), with every finding fixed test first. An accessibility and layout pass at 320 px in both languages and on a real phone (the totals and the notices of a ledger that failed to load have no `role`), the open questions of `DESIGN.md` §8 that the work raised, a run of the migrations on a copy of the production schema, `main` merged into the branch, the ADRs from `Proposed` to `Accepted`, the paragraph about the branch removed from `repository-structure.md`, a decision on a friend taken out of the list of New group and put back, which hits `already-member` for good since a member who left can't be re-added, and the owner's go-ahead. Then the pull request is merged with a merge commit (`gh pr merge --merge`).

- A failed Google sign-in lands on `/?signin=failed` and loses the invitation link from the address bar; an accept answers 200 for a friend that was deleted since (closed group) instead of 410; a `Referrer-Policy` response header is sturdier than the meta tag.
- `IN_EXPENSES` in `use-ledgers.ts` also syncs closed groups on every focus and reconnect after 60 s though a closed group no longer changes: skip a closed group once its entries are on the device.
- The budget warning after a shared add misses the group whose entries have not loaded yet (`entries ?? []`).
