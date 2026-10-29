# Tarja — Architecture

Source of truth for the project's decisions. `AGENTS.md` distills the rules that are easy to break; if a decision changes, update this document first. Visual rules live in `design.md`. Remaining work lives in `TODO.md`.

## 1. What it is and scope

An installable web app (PWA) to log everyday expenses: food, groceries, leisure, bills, rent. Each expense gets a category that is suggested from the text the user types and can be changed. Expenses can be logged offline.

Name: a _tarja_ is the notched stick that was used to keep accounts. The repo is `spa-tarja`, like the owner's other SPAs.

Out of scope for now: importing a backup, shared expenses, multiple currencies.

## 2. Closed decisions

- **Everything about the project is in English**: docs, code, comments, identifiers and commit messages. Only the UI copy is localized (§9).
- **Solo project, work on `main`.** There is one developer, so no feature branches and no pull requests; commits go straight to `main`.
- **SPA, not SSR.** Everything sits behind a login (no SEO), categorization runs on the client and the app must work offline. Server-side first render would add nothing.
- **A single Cloudflare Worker** serves the static assets and the API (`/api/*`) from the same origin. The session lives in an `httpOnly` cookie, with no CORS and no tokens in the browser.
- **Workers with assets, not Pages.** Cloudflare has put Pages in maintenance and focuses its investment on Workers. The free URL is therefore `tarja.<subdomain>.workers.dev`, not `pages.dev`. A custom domain needs its nameservers on Cloudflare.
- **Vite + React + Hono + D1.** Hono is only the API layer; the client uses `hc<AppType>` to get the route types without a framework. A framework's `loader`/`action` assume the network on every navigation, while here reads always come from local storage.
- **Mobile-first.** The app is used on the go, so base styles target phones and widen with `min-width` queries (§9).
- **Progressive offline-first** (§6): online first, the offline queue arrives in its own phase.
- **Google login**, no own passwords (§8).
- **Default categories** can't be edited or deleted for now. Custom ones can be created, edited and deleted.
- **Free tiers only.** If something needs payment, it is dropped. Cloudflare limits as of 2026-10-25 (official docs): D1 free gives 5 M rows read and 100 k rows written per day and 500 MB per database; Workers give 100 k requests per day. D1 counts every row a query scans as a read, so queries must be indexed by user and date.
- **Plain CSS** (variables and native nesting), no SCSS and no Tailwind. Reversible if needed.
- **Style**: flat colors with themes (system, light, dark), a white or black base, an accent picked from a fixed list, a color and an icon for every category, IBM Plex Mono, no rounded corners, the notch border (thick on the left and the bottom) and animated transitions. All visual rules, and what is still open, are in `design.md`.

## 3. Stack (versions as of 2026-10-25)

| Piece                              | Version            | Note                                                                                         |
| ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
| pnpm                               | 12.15.0            | `save-exact` in `.npmrc`; `pnpm add -E`                                                      |
| Vite / @vitejs/plugin-react        | 8.3.5 / 6.1.2      |                                                                                              |
| React                              | 19.3.1             |                                                                                              |
| TypeScript                         | 6.0.3              | 7.0 exists, but `typescript-eslint` 8.72 requires `<6.1`                                     |
| Hono                               | 4.13.13            |                                                                                              |
| TanStack Router / Query            | 1.170.46 / 5.104.5 | File-based router through the Vite plugin                                                    |
| use-intl                           | 4.14.9             | Same i18n setup as `spa-hoardex`                                                             |
| Wrangler / @cloudflare/vite-plugin | 4.152.0 / 1.65.0   | `vite dev` runs the Worker in `workerd` with a local D1                                      |
| vite-plugin-pwa                    | 2.0.0              | With `workbox-build` and `workbox-window` 7.4.1; icons by `@vite-pwa/assets-generator` 2.0.0 |
| Vitest / @cloudflare/vitest-plugin | 5.0.5 / 1.4.7      | The plugin used to be `@cloudflare/vitest-pool-workers` (now deprecated)                     |
| ESLint                             | 9.39.5             | `eslint-plugin-import` doesn't support ESLint 10                                             |
| Prettier / Stylelint               | 3.9.10 / 17.16.0   |                                                                                              |

For the visual identity (`design.md`): `@fontsource/ibm-plex-mono` 5.3.0 (OFL 1.1, self-hosted and precached). The Sharp SVGs of Material Symbols (Apache 2.0, from `@material-symbols/svg-400` 0.48.1) are copied into `src/components/icon` with their notice, not kept as a dependency, and a subset of Dot Matrix with the letters of the logo sits in `src/assets/fonts`.

Install scripts allowed in `pnpm-workspace.yaml`: `workerd` and `esbuild`. pnpm 12 also offers "agent skills" shipped by some packages; the two that offer them (`@tanstack/react-router` and `@tanstack/router-plugin`) are denied in `pnpm-workspace.yaml`, since they only feed AI assistants and the build doesn't need them.

## 4. Repo layout

```
server/   Worker (Hono): app.ts (routes and AppType), index.ts (entry)
src/      SPA: routes/ (file-based), features/, components/, lib/, assets/ (styles, locales)
db/       D1 SQL migrations (db/migrations)
core/     pure logic shared by client and server
public/   static files
```

- `server/` doesn't import from `src/`. `src/` only imports **types** from `@server/*`.
- `core/` imports nothing from React, Hono or Workers (ESLint enforces it). The category classifier, the money helpers, what counts in a month and the list and chart logic live there. Both sides import it as `@core/*`; the server also reaches its own subfolders as `@server/*`, so `../` is never needed.
- `wrangler.jsonc` sets `run_worker_first: ["/api/*"]` and `not_found_handling: "single-page-application"`: any path that isn't `/api/*` or a file falls back to `index.html`, and an unknown `/api/…` answers 404 from the Worker.
- `worker-configuration.d.ts` (runtime and binding types) is generated with `pnpm types:gen` and committed. Regenerate it after editing `wrangler.jsonc`.
- **Production** is `https://tarja.antoniolbz.workers.dev` (account subdomain `antoniolbz`, free). The D1 database `tarja` is bound as `DB` with its `database_id` committed in `wrangler.jsonc` (an id, not a secret). A release goes out on its own: every push to `main` that passes the checks is deployed by GitHub Actions (§10), after applying the migrations if `db/migrations` changed. By hand it is `pnpm db:migrate:remote`, then `pnpm deploy:prod`. The migrations go first so the new code never meets an old schema, which means each one must work with the code still running: add, never rename or drop. Secrets go up with `wrangler secret put`.

## 5. Data

Hand-written SQL migrations in `db/migrations`, applied with `wrangler d1 migrations`; no ORM. The schema is small and `wrangler` already is the migration tool. Queries are typed next to the code that runs them and tested in `workerd` against a real D1.

- Amount as an integer in cents plus a currency code, never a `float`. There is a single currency for now (`EUR`, `DEFAULT_CURRENCY` in `core/`); the code is stored on each row so adding more later needs no migration.
- `id` is a UUID created on the client (§6) and is the primary key. `PUT /expenses/:id` creates the row or updates it, but only when it belongs to the caller: an existing id owned by another user is rejected, never overwritten.
- Columns: `user_id`, `category_id`, `text`, `amount_cents`, `currency`, `date`, `created_at`, `updated_at`, `deleted_at` and `seq`.
- `date` is the day the user picked, as `YYYY-MM-DD` text (no time zone to get wrong). `created_at`, `updated_at` and `deleted_at` are epoch milliseconds.
- `updated_at` is the client clock and only decides conflicts (§6). It can't be the sync cursor: an edit made offline last week arrives with an old `updated_at`, and a device whose cursor is already past it would never pull it. The cursor is `seq`, a per-user counter the server bumps on every write (`MAX(seq) + 1` inside the upsert, which D1 serializes).
- Indexes: `(user_id, date)` for listing and `(user_id, seq)` for the sync by delta. Soft deletes travel as rows with `deleted_at` set, so the delta query sees them.
- `categories` holds the custom categories (§7), in migration `0002`; migration `0004` adds their `color` and `icon`.
- Rows belong to the signed-in user (§8), resolved in a single place in the server.

### When an expense counts

An expense is made on its `date` but can count on another day. The list keeps showing it on the day it was made; the totals and the charts use the day it counts.

The charts need no endpoint: they aggregate the expenses the device already holds (`core/charts.ts`), so they work offline and see unsynced changes. Weeks start on Monday, a range includes both of its ends, and every row of a chart is a day, a week or a month of that range, empty ones too, up to 400 rows. The total of a range is compared with an earlier span as long as the one compared (`comparison`). A range of whole rows that has already ended compares with as many rows right before it (`previousRange`): days with as many days, twelve weeks from Monday with the twelve before, and October by month with September once October is over. Any other range that has ended compares with as many days right before it, so 15 to 31 October with the 17 days before. A range still running is compared only up to today, its days so far against as many days right before its start: on 3 October the month by day compares 1 to 3 October with 28 to 30 September, while the stat row still shows the total of the whole month. A range that starts after today compares with nothing. The owner confirmed this rule on 2026-10-29. Both sides go through `spendingTotal` with the same category. The scale of a chart is worked out there too (`niceScale`: 3 to 5 round ticks from 0).

- **The list is by the day made, not by what counts.** The expense list (`core/expense-list.ts`) filters, groups and adds up by `date`: a search or a date range looks at the day made, week and month groups are those of the day made (weeks start on Monday), and the subtotal on each group adds what its rows show, a plan once at its full price on its purchase day (`planTotal`) and a restaurant card expense at your part (`countedCents`). A credit card expense or a part of a plan is therefore never moved to the day it is charged there, so a subtotal is not what was spent in that period and can differ from the summary and the charts, which read `countedOn`. Everything is computed on the device from the local expenses, so it works offline and sees what is not synced yet.
- **Deferred expenses** (migration `0005`) add `payment` (`direct`, the default, `credit` for a credit card or `voucher` for a restaurant card) and `charge_date`, the day it is charged when that isn't `date`: the day a credit card expense counts on, and the month whose income a restaurant card expense adds to. A `credit` or `voucher` expense must have a `charge_date`, and no `charge_date` can come before `date`. The form proposes the same day of the next month and the person can pick any date. Older clients that don't send the two columns write `direct` and no `charge_date`, which is what they always meant.
- **Counted on** is `charge_date` when there is one and `date` otherwise, except for a restaurant card, which counts on `date` (`countedOn` in `core/counting.ts`). A month's spending is what counts in that month, whatever category it has: the whole amount of a `direct` or `credit` expense, your part of a `voucher` one (`countedCents`). What counts goes through these helpers in the summary, the charts and the list; `amount_cents` and `charge_date` are read directly only to say them in a row's details (what the card paid, the day it is charged), never to add anything up.
- **Your part of a restaurant card** (migration `0008`): `personal_cents` is what was yours of what the card paid, when others pay you back the rest (a dinner for two paid with the card, the friend sending their half). It is valid only on a `voucher` expense and only from 0 to `amount_cents`; the API answers 400 otherwise. NULL means the same as `amount_cents`, with no backfill, so the rows written before it and older clients that don't send it keep their full amount; a write from a client that doesn't send it stores NULL, which is what that client always meant.
- **A restaurant card also counts as income.** What the card paid for you, your part, is income of the month it is charged, dated the 1st of the month of `charge_date` whatever its day (`voucherIncomeOn`). What others pay back, `amount_cents` minus your part, is income of the month the expense was made (`paidBackCents`). That income is derived when reading, never stored, so an expense stays one row and `PUT /expenses/:id` stays idempotent. What is left over in a month is its income, plus the restaurant-card income of the month, plus what was paid back in it, minus all the expenses counted in it. Example: a 40 € dinner on 12 October with the card, your part 20 €, charged on 12 November, counts 20 spent and 20 paid back in October, and 20 of restaurant-card income in November.
- **Past months move** with this rule: before `0008` a restaurant-card expense counted its whole amount as spent and as income, both in the month of its charge date. Now it counts as spent in the month it was made. An old row has no part, so its spent and its card income stay its whole amount and nothing is paid back, but its spent moves from the charge month to the month it was made, so the spent and the leftover of past months can change; the card income stays in the charge month.
- **Installments** (migration `0006`) are plain expenses linked by a `plan_id` (a UUID made on the client), with `plan_part` (1 to `plan_parts`) and `plan_parts` (2 to 36). Each part has its own amount and its own `charge_date`, one per month starting at the purchase date, and counts in its own month. Splitting is done on the client, in cents, the remainder going to the first parts; the form shows what is still unassigned and refuses to save until the parts add up to the total, and refuses a part that goes over it. The form offers up to twelve payments, and only for an expense paid at once, since a credit or restaurant card already has its own charge date; changing the total or the number of payments splits again. Each part is one idempotent `PUT`, so a plan syncs, retries and conflicts like any expense. The list shows a plan as one row on the purchase day with its total, and deleting it soft-deletes every part.
- **Income** (migration `0007`) is a table `income` with one row per user and month (`month` as `YYYY-MM`, `amount_cents`, `currency`, `updated_at`). Like the custom categories, setting it needs a connection: it is done a few times a year, so a second outbox would buy little. `GET /income`, an idempotent `PUT /income/:month` and `DELETE /income/:month`. The list sits in the persisted cache, so the leftover can be read offline.

### Searching and grouping the list

- `buildList(expenses, filters, grouping, ctx)` is a pure function of the expenses held on the device. It drops the deleted rows, sorts newest first (the day made, then `createdAt`), collapses the parts of a plan into one row, filters on the row shown (a plan's first part) and groups the rows by day, week, month or category. Each group carries its subtotal. The collapse comes first so that a plan is searched, filtered and counted once, and an edit or a delete always gets every part of the plan, never a filtered copy.
- **Filters**: the text (every normalised word of the search is a substring of the description plus the name of the category as the row shows it; `normalizeText` in `core/text.ts` lowercases and strips accents, as the classifier does), the category, a range on the day made with both ends included and either one optional, and how it was paid (any, now, credit card, restaurant card, installments). An expense whose category no longer exists counts as the fallback category inside the filter and the grouping only; the expense itself is not rewritten (§7).
- **Groups**: days, weeks (from Monday) and months newest first, categories by subtotal from the biggest and by id on a tie.
- The filters are the screen's state and are lost on leaving it, so a stale filter cannot hide a new expense. The grouping is a preference kept in `localStorage` as `tarja:list-grouping`. The search is deferred (`useDeferredValue`) and the list draws 100 rows at a time, with "Show more", rather than windowing it: the cards vary in height, a deleted row fades out before it goes and the browser's find in page has to see the rows.
- `buildList` is `listItems` (drop, sort, collapse: depends on the expenses only, so it runs once per change of data) followed by `groupItems` (filter and group: runs on each keystroke, with the text a search looks in built once per expense), and `limitRows` cuts the groups at the rows to draw while each keeps its whole subtotal.

### Editing an expense

- An edit is the same idempotent `PUT /expenses/:id` as a new expense, one per row, through the outbox, so it needs no endpoint or migration and works offline. The add form loads the expense (`draftOf`) and `reviseExpenses` (`src/features/expenses/create-expenses.ts`) turns what it holds into the writes. Each row keeps its `id`, `created_at` and `currency`, and its `updated_at` is the later of now and one more than the newest `updated_at` it replaces, so a device whose clock runs behind still wins over the version it edited instead of losing the edit silently (§6). Delete takes the same rule.
- A plan is edited whole, charged parts included. Its parts keep their ids by part number; a part it gains is a new row under the same `plan_id`, made when the plan was so the plan keeps its place in the list, and a part it loses is saved as deleted. A plan turned into one payment or into a card payment is its first part with no plan; an expense turned into a plan becomes the first part of a new plan. A plan can be edited only when every part of it is on the device.
- Your part goes only with a restaurant card: an edit that pays it another way sends `personalCents: null`, since the API answers 400 otherwise and the outbox drops a 400 for good.
- The category stays the saved id, even one whose category was deleted (it shows as "Other" and is kept unless the person picks another); the suggestion from the text never replaces it.
- Known limits, acceptable for one person: a plan edited on two devices before they sync can end up with parts of both edits, because each part wins on its own; and an edit made after a delete on another device brings the expense back, as the newer write.
- **Undo after a delete.** Delete keeps no confirmation, so it can be taken back for a few seconds (the `Toast` of `design.md`). `restoreExpenses` writes every deleted part again with `deleted_at` null and an `updated_at` of the later of now and one more than the deletion, the later-than rule of an edit, so it wins over the delete on every device. It goes through the outbox like any write: offline it replaces the entry of the delete that is still waiting, so the server never hears of either, and after the delete has synced it is one more `PUT`. A plan comes back whole. Only the last delete can be undone: there is no history.
- Confirmed by the owner (2026-10-29): editing a plan edits the whole plan, charged parts included; Edit replaces a new expense half typed in the form without asking; Delete keeps no confirmation; adding an expense clears the search and the filters of the list, not its grouping.
- **Duplicating an expense** is the add form loaded with an expense (`draftOf`) and saved as a new one, so it needs no endpoint or migration and works offline like any new expense. `createExpenses` gives every part a new id and a plan a new `plan_id`, and keeps the currency of the original. The day is today and `created_at` is now; a deferred payment takes the charge date the form proposes for that day; a plan keeps its number of payments and its amounts, on dates counted from today. It opens the form and saves nothing by itself (owner decision), replaces a half typed expense without asking, and, like Edit, is only for a plan with every part on the device (`canEdit`). `AddFormProvider` holds it as `copying`, next to `editing`, and never both at once.

### Budgets

Specified on 2026-10-29, not built yet: this section is the spec until the code lands, and the note goes away with it. Owner decisions: a limit for the month's total and one for each category, warnings inside the app only (never a push), and a budget never blocks anything: it only warns.

- **Storage** (migration `0009`): a table `budget` with one row per user, month and scope (`user_id`, `month` as `YYYY-MM`, `scope`, `amount_cents`, `currency`, `updated_at`; the key is `(user_id, month, scope)`). `scope` is `total` or a category id; no category has the id `total` (a test checks the default ids, the custom ones are UUIDs). `amount_cents` goes from 0 to `MAX_AMOUNT_CENTS`, and **0 means no limit** from that month on.
- **The limit of a month** (`limitFor` in `core/budget.ts`, pure) is the row of the latest month up to and including it, for that scope; none, or a 0, is no limit. A month nobody set has no row of its own and holds the limit of the latest earlier month, so a limit stays until a month sets another and setting one never writes the months after it. Saving a month again replaces its row, so editing it three times is still one row. A 0 is stored, never deleted: deleting the row would make the month hold the earlier limit again. A change reaches every later month that has no row of its own. A value equal to the one the month already holds is not written, a 0 over no limit included.
- **What counts toward it** is what the summary counts: each expense adds `countedCents` to the month of `countedOn` (§5), the total adds all of them and a category the ones filed under it. An expense whose category no longer exists counts as "Other", as in the list. A credit card expense therefore counts in the month it is charged, and a warning says which month it speaks of: that closes the open question about a credit card whose charges pile up in a month.
- **A percentage is shown, never typed.** A limit is an amount. When the month has an income (the one the person set, without the restaurant card or what was paid back), a limit is also shown as `round(limit ÷ income × 100)` % of it, which can go over 100, and its use as `round(spent ÷ limit × 100)` %. Neither is stored.
- **Thresholds** (`core/budget.ts`): near is 80 % of the limit spent or more, over is more than the limit; spent exactly at the limit is near.
- **Warnings** come when an expense is added or duplicated, never when one is edited or deleted. For each month and scope the saved parts count in, the state before and after is compared (none, near, over): a warning comes only when a state is crossed (none to near, none to over, near to over), so being over already doesn't warn again. It also comes when the month has an income and its leftover (`summarizeMonth`) goes from zero or more to below zero. There is one message: the most serious (the leftover below zero, then over, then near), then the earliest month, then the scope with the highest use. A plan warns for the most serious of its parts. No limit, no warning.
- **API**, like the income: `GET /budgets` answers every row of the user (`month`, `scope`, `amountCents`, `currency`) and an idempotent `PUT /budgets/:month` takes `{ currency, limits: [{ scope, amountCents }] }` (1 to 200 entries, each scope once) and replaces those rows in one D1 batch, all or nothing. There is no `DELETE`. The server checks the shape of the month and of each scope (`total`, a default id or a UUID), never that a category exists, as for an expense (§7). Deleting a category deletes its rows in the same batch, and the client ignores the rows of a scope it doesn't know.
- **Offline**, like the income: changing a limit needs a connection, and the `budgets` list sits in the persisted cache (§6), so the bars and the warnings work from the local copy.
- **Backup**: the JSON gains `budgets`, the rows as they are stored. The version stays 1, as nothing reads a backup yet.

### Exporting your data

Settings offers a backup and a spreadsheet (owner decision: export only, no import for now). Both are built on the device from what it already holds, the persisted cache with the outbox on top (`applyPending`), so they work offline and send nothing to the server. Settings reads the expenses, the categories, the income and the budgets like any other screen does, so a device that never opened the summary still has its income and its budgets in the backup; a device that has never heard from the server exports only what is waiting in its outbox. Deleted expenses are left out, and the logic is pure, in `core/export.ts`.

- **JSON** is a backup: `{ app: "tarja", version: 1, exportedAt, expenses, categories, income, budgets }`. `exportedAt` is an ISO 8601 time. `expenses` are the stored fields as they are, one entry per expense and one per part of a plan, ordered by the day made, then `createdAt`, the part and the id. `categories` are the custom ones only (`id`, `name`, `color`, `icon`), since the built-in ones come with the app, `income` is the months the person set and `budgets` the rows of the limits as they are stored, ordered by month and then scope. Nothing in it is derived, so a later import can restore a database from it.
- **CSV** is for a spreadsheet: one row per expense or part of a plan, in the same order, with the columns date, text, category, amount, currency, payment, charge date, your part and part. The header, the category name (the built-in names in the language of the app, "Other" for one that no longer exists) and the payment are in the app language. Days are `YYYY-MM-DD`. The amount is what was paid, in the decimals of the language without a currency symbol or grouping: Spanish uses `;` between columns and `12,50`, English `,` and `12.50`, as the delimiter follows the decimal mark. Your part is filled for a restaurant card expense only (the whole amount when none was set) and empty for the rest; the part is `2/3` for the second of three payments and empty for an expense that is not a plan. The file is UTF-8 with a byte order mark, so a spreadsheet reads the accents, and fields are quoted when they hold the delimiter, a quote or a line break.
- **A spreadsheet never runs a text.** A text or a category name that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading `'`, so the cell is read as text and never as a formula.
- The file is `tarja-YYYY-MM-DD.json` or `.csv`, with the day of the device.

## 6. Offline strategy

- **Shell**: PWA with `vite-plugin-pwa` (Workbox, `generateSW`) precaching the app. Navigations fall back to `index.html` except `/api/*`. Updates use `registerType: 'prompt'`: the new version waits until the user accepts it, so it never reloads the app halfway through an expense. Icons are generated from `public/favicon.svg` with `pnpm pwa:icons`.
- **Reads**: TanStack Query with the cache persisted in IndexedDB (`@tanstack/react-query-persist-client`, no expiry, only the `expenses`, `categories`, `income` and `budgets` queries), under the signed-in user's id (§8). The cache holds everything the server has told this device, tombstones included, plus the cursor of the last change seen.
- **Writes**: a save never waits for the network. The expense, with its client UUID, goes into the **outbox**: an IndexedDB record of the latest version of each unsynced expense, so editing or deleting a pending expense replaces its entry. The screen shows the cached server data with the outbox on top, and marks the pending rows.
- **Sync** is the `queryFn` of the `expenses` query, so every trigger Query already has (app open, focus, reconnect, invalidation after a save) runs the same path: push the outbox in order, then pull what changed after the cursor. Safari has no Background Sync, so nothing depends on it. While entries are pending the query also retries every 30 s, for connections that report online but aren't.
- **Outbox rules**: an entry leaves the outbox only when the server answered it, and only if it wasn't edited meanwhile (same `updatedAt`). A network error or a 5xx stops the push and keeps the order for the next run. A 400 or 409 is permanent: the entry is dropped and the user is told.
- **Server**: idempotent `PUT /expenses/:id` (creates or updates by id), so retrying is safe. A delete is the same `PUT` with `deletedAt` set; there is no `DELETE` route. `GET /expenses?after=<seq>` pages through the changes after a cursor, tombstones included, and returns the new cursor.
- **Exceptions to the outbox**: the custom categories (§7), the monthly income and the budgets (§5) need a connection to be changed, and all of them are read from the persisted cache.
- **Conflicts**: last edit wins by `updatedAt`, enough for one user on several devices. The server applies a write only when its `updatedAt` is strictly newer than the stored one (so a retry changes nothing) and otherwise answers with the row it kept. Deletes are soft so the sync can propagate them. The clock is the device's: a device whose clock is behind loses to rows written ahead of it, silently.

## 7. Categories

- Default categories (initial proposal: food, groceries, leisure, bills, housing/rent, transport, health, other) are read-only. They live in `core/` with stable ids; their names come from the locale files, not from the database. Custom categories live in D1, so `expenses.category_id` has no foreign key to the defaults.
- **Custom categories** live in the `categories` table (`id` a UUID made on the client, `user_id`, `name`, `name_key`, `created_at`). Unlike expenses, managing them needs a connection: `GET /categories`, an idempotent `PUT /categories/:id` that creates or renames, and `DELETE /categories/:id`, which really deletes the row. Offline-first buys little for something done rarely, and it would need a second outbox with its own ordering. The list sits in the persisted query cache, so an offline device can still file expenses under the categories it has seen.
- **Color and icon.** Every category has a color key and an icon key from fixed lists (`design.md`). The defaults carry theirs in `core/`. Custom categories get `color` and `icon` columns in `categories`, in a migration of their own that gives the existing rows the default color and the generic icon; the manager chooses them next to the name and the server accepts only keys of those lists. An expense never stores them: it only has `category_id`, and a category that no longer exists shows as "Other", with its color and icon.
- **An expense is never refused for its category.** The server checks only the shape of `category_id` (a default id or a UUID), never that the row exists: the category may have been deleted on another device, or created while this one was offline. An expense whose category no longer exists shows as "Other" and keeps its id.
- Names are trimmed, up to 40 characters, and unique per user ignoring case and accents (`name_key`, unique with `user_id`); a clash answers `409 name-taken`. The app also checks them against the default names of the current language.
- Auto-selection is a dictionary of normalized keywords (lowercase, no accents) in English and Spanish that runs on the client, with the logic in `core/`. The user can change it on each expense.
- **From the person's own history.** Only when the keywords find nothing, so the suggestion would be "Other", the words of the typed text are looked up in the expenses already on the device (`core/history-suggestion.ts`). A word counts when it has at least 4 letters, whole and ignoring case and accents, and every earlier expense that has it is in the same category; a word seen in several categories is ignored, which also drops filler like "con" or "with". The category with the most such words wins and, on a tie, the one with the most earlier expenses that carry them, a plan counting once. Deleted expenses and categories that no longer exist are skipped, and a custom category can be suggested, which the keywords never do. It runs on the client from the local copy, with no storage, request or screen of its own, and the hint is the one of a keyword suggestion. A category picked by hand is never replaced. A category the person corrected is the one stored on the expense, so the history is how the app learns from corrections.

## 8. Authentication

Google OAuth, no own passwords, through Better Auth mounted on Hono at `/api/auth/*`. Better Auth takes the D1 binding directly. It needs the `nodejs_als` compatibility flag (it uses `AsyncLocalStorage`).

- **Tables**: `user`, `session`, `account` and `verification`, in migration `0003`. They are written by hand, like the rest of the schema, and a test fails if Better Auth asks for a table or column the migration lacks.
- **Sessions**: an `httpOnly` cookie signed with `BETTER_AUTH_SECRET`, valid for 30 days. A 5 minute cookie cache lets most requests skip D1. A revoked session can therefore stay valid for up to 5 minutes.
- **Base URL**: the origin of each request, so the same code runs on `localhost`, `workers.dev` and any later domain without configuration. Cloudflare only routes the Worker's own hosts, Google only redirects to the URIs registered in its console, and Better Auth rejects cross-origin `POST`s against that origin.
- **Access**: `/api/expenses`, `/api/categories`, `/api/income` and `/api/budgets` answer `401` without a session; `/api/health` and `/api/auth/*` are public. The owner of every row is the Better Auth `user.id`. Any Google account can sign in. Rows saved while the login didn't exist belong to the old fixed user and are unreachable now.
- **Client**: no Better Auth client, to keep the bundle small. Three calls (`src/lib/auth/service.ts`): `GET /api/auth/get-session`, `POST /api/auth/sign-in/social` (the answer carries the Google URL to go to; Google sends the person back to `/`, or to `/?signin=failed`) and `POST /api/auth/sign-out`. A small store (`createAuth`) holds the state: `loading`, `signed-out` (with `unreachable` when the server couldn't be asked) or `signed-in`. `AuthGate` shows the sign-in screen to everybody but a signed-in user, and `AppProviders` (`src/providers.tsx`) mounts the whole app inside it.
- **Offline**: the signed-in user's profile is kept in `localStorage`, so the app opens signed in with no network. Only a definite answer signs the user out: a `get-session` with no session, or a `401` from the API. A network error or a `5xx` never does. Without a cached profile and without a connection there is nothing to show but the sign-in screen, which says so.
- **Local data belongs to a user**: the outbox and the persisted cache are stored under the user id (`tarja:outbox:<id>`, `tarja:query-cache:<id>`; `createUserStorage`), so another account on the same browser never sees or pushes them. `UserDataProvider` builds them for the signed-in user and is remounted when the user changes. A `401` from any query or mutation makes the app ask `get-session` again (`createQueryClient({ onUnauthorized })`); an unsynced expense is kept, as a `401` is not a permanent refusal. Signing out deletes the user's local data only when nothing is waiting to sync; otherwise it stays for the next sign-in of that user. Signing out needs a connection, because the cookie is `httpOnly` and only the server can end it. Data stored before the login existed sits under the old unscoped keys and is never read.
- **Secrets**: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, in `.dev.vars` locally (`.dev.vars.example` lists them) and in `wrangler secret` in production. Google's console must list `<origin>/api/auth/callback/google` for each origin in use.

## 9. Frontend

- TanStack Router (file-based; `src/routeTree.gen.ts` is generated by the Vite plugin and committed) and TanStack Query. API client: `hc<AppType>('/')` in `src/lib/api`.
- Imports in `src/`: `./` inside the same folder, otherwise `@/` (and `@server/` for types only), never `../`.
- **i18n** with `use-intl`, as in `spa-hoardex`. Messages live in `src/assets/locales/{en,es}.json`, English is the default and the source of the key types. The locale comes from the stored preference, then `navigator.languages`, then English, and it is not part of the URL. A test checks that every locale has exactly the same keys. No UI copy is hard-coded in components.
- **Mobile-first**: base CSS targets phones and widens with `@media (width >= 40rem)` and `(width >= 64rem)`. Touch targets are at least `--size-touch` (44 px), layouts honor `env(safe-area-inset-*)` (`viewport-fit=cover`), full-height blocks use `dvh`, and form controls inherit 16 px so iOS doesn't zoom on focus.
- Styles: variables in `src/assets/styles/tokens.css`, BEM in the CSS of each route or component, Stylelint with alphabetical properties and no `!important`. Transitions always use the `--duration-*` and `--ease-*` tokens; `prefers-reduced-motion` zeroes them in a single place.
- Visual rules (colors, themes, shape, motion) live in `design.md`.
- Shared components live in `src/components/<name>/` with their CSS and tests next to them: `Brand` (the logo), `UpdatePrompt` (the offer of a new version), `Notice`, `Toast`, `Button`, `Field`, `DateRangeFields`, `Card` and `CardList`, `Disclosure`, `ChoiceGroup` and `Icon`. Screens compose them instead of restyling raw elements (`design.md` §3, "Components").
- `src/lib` never imports from `src/features` (ESLint enforces it), so the composition of the app around its pages lives in `src/providers.tsx`, used by `main.tsx` and by the tests.

## 10. Testing

- Vitest with three projects. `core`: node, for the pure logic. `server`: `@cloudflare/vitest-plugin` runs the tests in `workerd` with a real local D1 (`env` from `cloudflare:workers`). `front`: jsdom and Testing Library, with `stubApi` and `renderApp` in `src/lib/test/render-app.tsx`; `renderApp` mounts the real `AppProviders` (language, theme, sign-in gate and per-user data) over memory storage and a fake sign-in (`createFakeAuth`: signed in as `TEST_USER` unless told otherwise), and tests read their expected copy from `en.json`.
- A request without a handler in a test fails; it never reaches the network.
- **CI and the hook**: a husky `pre-commit` runs `format:check`, `types:check`, `lint` and `test`. GitHub Actions (`.github/workflows/ci.yml`) runs the same plus `build` on every push to `main`. Once `check` passes, the `release` job applies `db/migrations` to the production D1 (`pnpm db:migrate:remote`) if that folder differs from the last commit whose CI run went green, then runs `pnpm deploy:prod`. The baseline is the last green run, not the push, because a queued run can be dropped and its migrations would go unseen. A failed migration stops the deployment. The job has its own `concurrency` group that never cancels a run in progress. They need two repository secrets: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (the "Edit Cloudflare Workers" template plus Account → D1 → Edit). The Worker's own secrets stay in `wrangler secret`.

## 11. Roadmap

0. **Skeleton** (done): Vite + Hono + local D1, `/api/health`, i18n, tests, lint and formatting.
1. Installable PWA: manifest, icons, service worker, offline shell (done).
2. D1 schema, expenses and default categories: API and UI (done).
3. Offline queue and sync (done).
4. Google login and per-user data (done).
5. Custom categories (create, edit, delete) (done).
6. Visual identity and transitions (done).
7. CI and husky (done), then automatic migrations and deployment to Cloudflare from GitHub Actions.

## 12. Discarded and open decisions

Discarded:

- **Next.js 16**: SSR and RSC would go unused and, on Workers, it needs the OpenNext adapter.
- **React Router 7 in framework mode**: its `loader`/`action` assume the network.
- **Cloudflare Pages**: in maintenance.
- **Cuadra, Menudo, Tally, Slate, Tab** as a name: taken on `.app`, `.dev` and `.com`.
- **Guest mode** (use the app with no account, local data only, moved to the account on sign-in), discarded by the owner on 2026-10-29: it overturns "Google login only", every future feature would need a guest behaviour, and guest data can be lost with the browser's storage. Revisit only if strangers should be able to try the app.
- **PWA shortcuts** on the installed icon, discarded by the owner on 2026-10-29: the icon already opens on the add form.
- **Recurring expenses**, not needed for now according to the owner (2026-10-29): duplicating an expense covers it.

Open:

- Locales beyond `en` and `es` (`spa-anicalendar` also ships `fr` and `de`).
- Domain: `tarja.dev` is available (2026-10-25) but costs money, which clashes with "free tiers only"; `tarja.app` and `tarja.com` are taken. `workers.dev` is in use; a custom domain would mean updating the Google redirect URIs.
