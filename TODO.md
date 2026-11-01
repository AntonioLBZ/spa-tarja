# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the layout on a real iOS Safari: safe areas, keyboard, install, the Undo toast, that the JSON and the CSV files download from the installed app, the Dot Matrix logo in the header and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches). Android Chrome, the installed app and the web, was seen by the owner and is right. The colors wait for a review with the owner, and so do the Dot Matrix logo and whether categories keep a color of their own ([DESIGN.md §8](design-system/DESIGN.md#8-open-questions)).
- Retire the notice that the app moved once nobody opens the old address: `AppMoved` (`features/pwa`), `src/lib/address.ts` and its strings in the locales go, and `"workers_dev"` in `wrangler.jsonc` turns to `false` so the old address stops answering. `Dialog` stays.
- **Review the shared expenses proposal** (pull request #1, branch `feat/shared-expenses`): ADR-0012 to ADR-0014 and the specs `groups`, `shared-expenses`, `balances`, `invitations` and `bottom-navigation` are written and `Proposed`; no code is written before the owner approves. Already answered by the owner (2026-11-01) and in the specs: a link can be for nobody in particular and a dummy can be merged into a real member, only that; shared expenses use default categories only, so the defaults grow; deleting a group deletes no expense and each person chooses per group whether it shows in their expenses; no several payers; deleting an account must be possible. Where the owner didn't say, the proposal picked this, and each can be changed:
    1. A group is deleted, and a member leaves, only while every balance involved is zero (settling up is always possible between any two members). A group of placeholders and its owner can be deleted at any time.
    2. Deleting a shared expense asks nothing and has Undo, like ADR-0010 (it deletes for every member).
    3. Simplified debts are off by default and a setting of the group, switched by the owner.
    4. A settlement is any amount of at least one cent, more than the debt included, which turns the debt round. This is the reading of "not 0 or negative" as the amount of the settlement.
    5. The new default categories: travel, shopping, gifts, treats, subscriptions, pets and education, with the icons, colors and keyword moves of `docs/specs/categories.md` (netflix and the like move from leisure to subscriptions, hotels and flights to travel). Confirm or change the list.
    6. Turning off "Show in my expenses" takes the group out of the list and of the summary, the charts and the budgets, not only out of the list.
    7. A person who leaves a group keeps seeing it as it was the day they left, read-only, and never what it spends afterwards.
    8. The default handle is the email, found only by an exact match, and never shown in a group; a username replaces it.
    9. A shared expense is paid at once (no credit card, restaurant card or installments).
    10. Below 40 rem the navigation is a bottom bar of four tabs; from 40 rem the header holds the four words.
    11. Deleting an account leaves the shared entries for the others, under "Deleted user", and passes a group to the member who is a user and joined first. A privacy notice (what is stored, why, who sees it, how to delete it) is needed once strangers can sign in; where it lives and its wording are the owner's.
- Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **The same component, another variant.** Not answered yet: the row of actions copied in `category-row`, `expense-row`, `expense-form` and `dialog` (a component or leave it), and the titles and hints repeated in eight CSS files (`:where(h1)` and `:where(h2)` in `base.css`, or leave them).
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

A Splitwise-like function on the branch `feat/shared-expenses` ([ADR-0012](docs/adr/0012-shared-expenses.md), [ADR-0013](docs/adr/0013-shared-entries-sync-through-an-outbox.md), [ADR-0014](docs/adr/0014-people-in-groups.md)). Nothing below starts before the owner approves the specs in the pull request. Each item gets its task plan when it starts, ends with `pnpm format:check`, `types:check`, `lint`, `test` and `build` green, updates the docs it touches in the same commits, and stays on the branch until the last item. Delete an item when it is done, as for the rest of this file.

### 19. Bottom navigation

[Bottom navigation](docs/specs/bottom-navigation.md) and the header on phones: `BottomNav` and its story, `Groups` in the header from 40 rem (the link leads to a placeholder screen until 25), the route depths and sections, the toast above the bar, the bar hidden while a field has the focus. Independent of the rest, so it can be reviewed on a phone first.

### 20. More default categories

The seven new defaults of [categories](docs/specs/categories.md): ids, the names in `en` and `es`, icons, colors in the palette table of `DESIGN.md`, the keywords moved or added, and the tests of the classifier and of the history suggestion. No migration. Independent of the rest, but the form of 26 needs it.

### 21. Username and profile

Migration `0010`, `GET` and `PUT /profile`, `GET /people/lookup`, the Profile section of the settings ([invitations](docs/specs/invitations.md)). Independent of 19 and 20.

### 22. The maths of shared expenses

In `core/`, pure and tested on their rules: the entry schema, `split` (equally, by percent, by amount, someone out), `balance` (credits and debits, who owes whom, merged members read as their target), `simplify`, and `shared-expense` (the rows of your part, with the switch Show in my expenses). The tests state the invariants: shares add up to the amount, balances add up to zero, simplified payments settle every balance, a settlement of more than the debt turns it round, a merge moves a balance and nothing else ([shared expenses](docs/specs/shared-expenses.md), [balances](docs/specs/balances.md)).

### 23. Groups on the server

Migration `0011`, the routes for groups, members, entries, the merge, the ownership and the switch, and the checks: membership on every call, the limits, `404` to a stranger, the read cut of a member who left, `409 closed`, leave and delete refused with a balance, default categories only. `signIn(email)` for the tests of several users ([groups](docs/specs/groups.md)).

### 24. Groups on the device

The `groups` and `group-entries` queries in the persisted cache, the second outbox, the sync per group, `createFakeApi` with groups, and closed groups ([offline sync](docs/specs/offline-sync.md)). Tested offline and with a dropped connection.

### 25. The screens of groups and friends

Groups, closed groups, a group, its settings, the people, the merge, leave and delete, the switch Show in my expenses, the balances and the settle up form, with their stories and copy in `en` and `es` ([groups](docs/specs/groups.md), [balances](docs/specs/balances.md)).

### 26. Sharing an expense

The add form split into its head and its two tails, the people with `Checkbox`, the three modes, only default categories, the ledger of a group, edit, duplicate and delete with Undo ([shared expenses](docs/specs/shared-expenses.md), [expenses](docs/specs/expenses.md)). `Checkbox` and its story come with it.

### 27. Invitations

Migration `0012` for `shared_invitations`, the three kinds of invitation, the routes, the join page, the invitations waiting in Groups, and the sign-in that comes back to the link ([invitations](docs/specs/invitations.md), [authentication](docs/specs/authentication.md)). Decide here whether a rate limit on lookups and tokens is worth a rule in Cloudflare.

### 28. Shared expenses in your own lists

The shared rows in the list, the summary, the charts, the budgets and their warnings, the history suggestion and the exports ([expense list](docs/specs/expense-list.md), [when an expense counts](docs/specs/expense-counting.md), [export](docs/specs/export.md)).

### 29. Simplified debts

The switch of the group and the simplified view of the balances ([balances](docs/specs/balances.md)). The maths is in 22 and the column in 23.

### 30. Delete the account

`DELETE /api/account` and the dialog in the settings ([authentication](docs/specs/authentication.md), [settings](docs/specs/settings.md)), tested against a user with expenses, groups they own, groups they are in, open invitations and balances. The privacy notice is the owner's.

### 31. Before the merge

An accessibility and layout pass at 320 px in both languages and on a real phone, the open questions of `DESIGN.md` §8 that the work raised, a run of the migrations on a copy of the production schema, `main` merged into the branch, the ADRs from `Proposed` to `Accepted`, the paragraph about the branch removed from `repository-structure.md`, and the owner's go-ahead. Then the pull request is merged with a merge commit (`gh pr merge --merge`).
