# Tarja — Architecture

Source of truth for the project's decisions. `AGENTS.md` distills the rules that are easy to break; if a decision changes, update this document first. Visual rules live in `design.md`. Remaining work lives in `TODO.md`.

## 1. What it is and scope

An installable web app (PWA) to log everyday expenses: food, groceries, leisure, bills, rent. Each expense gets a category that is suggested from the text the user types and can be changed. Expenses can be logged offline.

Name: a _tarja_ is the notched stick that was used to keep accounts. The repo is `spa-tarja`, like the owner's other SPAs.

Out of scope for now: budgets, charts, export, shared expenses, multiple currencies.

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
- **Style**: flat colors with themes (system, light, dark), a white or black base with a single accent, no rounded corners, uneven borders and animated transitions. All visual rules, and what is still open, are in `design.md`.

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

Install scripts allowed in `pnpm-workspace.yaml`: `workerd` and `esbuild`. pnpm 12 also offers to approve "agent skills" shipped by some packages; none have been approved.

## 4. Repo layout

```
server/   Worker (Hono): app.ts (routes and AppType), index.ts (entry)
src/      SPA: routes/ (file-based), features/, components/, lib/, assets/ (styles, locales)
db/       D1 SQL migrations (db/migrations, still empty)
core/     pure logic shared by client and server (doesn't exist yet)
public/   static files
```

- `server/` doesn't import from `src/`. `src/` only imports **types** from `@server/*`.
- `core/` imports nothing from React, Hono or Workers (ESLint enforces it). The category classifier and the money helpers will live there. Both sides import it as `@core/*`; the server also reaches its own subfolders as `@server/*`, so `../` is never needed.
- `wrangler.jsonc` sets `run_worker_first: ["/api/*"]` and `not_found_handling: "single-page-application"`: any path that isn't `/api/*` or a file falls back to `index.html`, and an unknown `/api/…` answers 404 from the Worker.
- `worker-configuration.d.ts` (runtime and binding types) is generated with `pnpm types:gen` and committed. Regenerate it after editing `wrangler.jsonc`.

## 5. Data

Hand-written SQL migrations in `db/migrations`, applied with `wrangler d1 migrations`; no ORM. The schema is small and `wrangler` already is the migration tool. Queries are typed next to the code that runs them and tested in `workerd` against a real D1.

- Amount as an integer in cents plus a currency code, never a `float`. There is a single currency for now (`EUR`, `DEFAULT_CURRENCY` in `core/`); the code is stored on each row so adding more later needs no migration.
- `id` is a UUID created on the client (§6) and is the primary key. `PUT /expenses/:id` creates the row or updates it, but only when it belongs to the caller: an existing id owned by another user is rejected, never overwritten.
- Columns: `user_id`, `category_id`, `text`, `amount_cents`, `currency`, `date`, `created_at`, `updated_at`, `deleted_at` and `seq`.
- `date` is the day the user picked, as `YYYY-MM-DD` text (no time zone to get wrong). `created_at`, `updated_at` and `deleted_at` are epoch milliseconds.
- `updated_at` is the client clock and only decides conflicts (§6). It can't be the sync cursor: an edit made offline last week arrives with an old `updated_at`, and a device whose cursor is already past it would never pull it. The cursor is `seq`, a per-user counter the server bumps on every write (`MAX(seq) + 1` inside the upsert, which D1 serializes).
- Indexes: `(user_id, date)` for listing and `(user_id, seq)` for the sync by delta. Soft deletes travel as rows with `deleted_at` set, so the delta query sees them.
- `categories` holds the custom categories (§7), in migration `0002`.
- Until the login exists (§8) every request is served as one fixed user, resolved in a single place in the server.

## 6. Offline strategy

- **Shell**: PWA with `vite-plugin-pwa` (Workbox, `generateSW`) precaching the app. Navigations fall back to `index.html` except `/api/*`. Updates use `registerType: 'prompt'`: the new version waits until the user accepts it, so it never reloads the app halfway through an expense. Icons are generated from `public/favicon.svg` with `pnpm pwa:icons`.
- **Reads**: TanStack Query with the cache persisted in IndexedDB (`@tanstack/react-query-persist-client`, no expiry, only the `expenses` query). The cache holds everything the server has told this device, tombstones included, plus the cursor of the last change seen.
- **Writes**: a save never waits for the network. The expense, with its client UUID, goes into the **outbox**: an IndexedDB record of the latest version of each unsynced expense, so editing or deleting a pending expense replaces its entry. The screen shows the cached server data with the outbox on top, and marks the pending rows.
- **Sync** is the `queryFn` of the `expenses` query, so every trigger Query already has (app open, focus, reconnect, invalidation after a save) runs the same path: push the outbox in order, then pull what changed after the cursor. Safari has no Background Sync, so nothing depends on it. While entries are pending the query also retries every 30 s, for connections that report online but aren't.
- **Outbox rules**: an entry leaves the outbox only when the server answered it, and only if it wasn't edited meanwhile (same `updatedAt`). A network error or a 5xx stops the push and keeps the order for the next run. A 400 or 409 is permanent: the entry is dropped and the user is told.
- **Server**: idempotent `PUT /expenses/:id` (creates or updates by id), so retrying is safe. A delete is the same `PUT` with `deletedAt` set; there is no `DELETE` route. `GET /expenses?after=<seq>` pages through the changes after a cursor, tombstones included, and returns the new cursor.
- **Conflicts**: last edit wins by `updatedAt`, enough for one user on several devices. The server applies a write only when its `updatedAt` is strictly newer than the stored one (so a retry changes nothing) and otherwise answers with the row it kept. Deletes are soft so the sync can propagate them. The clock is the device's: a device whose clock is behind loses to rows written ahead of it, silently.

## 7. Categories

- Default categories (initial proposal: food, groceries, leisure, bills, housing/rent, transport, health, other) are read-only. They live in `core/` with stable ids; their names come from the locale files, not from the database. Custom categories live in D1, so `expenses.category_id` has no foreign key to the defaults.
- **Custom categories** live in the `categories` table (`id` a UUID made on the client, `user_id`, `name`, `name_key`, `created_at`). Unlike expenses, managing them needs a connection: `GET /categories`, an idempotent `PUT /categories/:id` that creates or renames, and `DELETE /categories/:id`, which really deletes the row. Offline-first buys little for something done rarely, and it would need a second outbox with its own ordering. The list sits in the persisted query cache, so an offline device can still file expenses under the categories it has seen.
- **An expense is never refused for its category.** The server checks only the shape of `category_id` (a default id or a UUID), never that the row exists: the category may have been deleted on another device, or created while this one was offline. An expense whose category no longer exists shows as "Other" and keeps its id.
- Names are trimmed, up to 40 characters, and unique per user ignoring case and accents (`name_key`, unique with `user_id`); a clash answers `409 name-taken`. The app also checks them against the default names of the current language.
- Auto-selection is a dictionary of normalized keywords (lowercase, no accents) in English and Spanish that runs on the client, with the logic in `core/`. The user can change it on each expense.
- Whether the app learns from each user's corrections is an open decision.

## 8. Authentication

Google OAuth, no own passwords. Candidate: Better Auth mounted on Hono, with D1 and an `httpOnly` cookie session. It will need the `nodejs_compat` flag in `wrangler.jsonc`. Its fit with D1 is unverified; check it when that phase starts. Secrets go in `.dev.vars` (local) and `wrangler secret` (production), never in the repo.

## 9. Frontend

- TanStack Router (file-based; `src/routeTree.gen.ts` is generated by the Vite plugin and committed) and TanStack Query. API client: `hc<AppType>('/')` in `src/lib/api`.
- Imports in `src/`: `./` inside the same folder, otherwise `@/` (and `@server/` for types only), never `../`.
- **i18n** with `use-intl`, as in `spa-hoardex`. Messages live in `src/assets/locales/{en,es}.json`, English is the default and the source of the key types. The locale comes from the stored preference, then `navigator.languages`, then English, and it is not part of the URL. A test checks that every locale has exactly the same keys. No UI copy is hard-coded in components.
- **Mobile-first**: base CSS targets phones and widens with `@media (width >= 40rem)` and `(width >= 64rem)`. Touch targets are at least `--size-touch` (44 px), layouts honor `env(safe-area-inset-*)` (`viewport-fit=cover`), full-height blocks use `dvh`, and form controls inherit 16 px so iOS doesn't zoom on focus.
- Styles: variables in `src/assets/styles/tokens.css`, BEM in the CSS of each route or component, Stylelint with alphabetical properties and no `!important`. Transitions always use the `--duration-*` and `--ease-*` tokens; `prefers-reduced-motion` zeroes them in a single place.
- Visual rules (colors, themes, shape, motion) live in `design.md`.

## 10. Testing

- Vitest with three projects. `core`: node, for the pure logic. `server`: `@cloudflare/vitest-plugin` runs the tests in `workerd` with a real local D1 (`env` from `cloudflare:workers`). `front`: jsdom and Testing Library, with `stubApi` and `renderApp` in `src/lib/test/render-app.tsx`; `renderApp` mounts the real `LocaleProvider` and `ThemeProvider`, and tests read their expected copy from `en.json`.
- A request without a handler in a test fails; it never reaches the network.
- **CI and the hook**: a husky `pre-commit` runs `format:check`, `types:check`, `lint` and `test`. GitHub Actions (`.github/workflows/ci.yml`) runs the same plus `build` on every push to `main`. It needs no secrets; the deployment isn't part of it yet.

## 11. Roadmap

0. **Skeleton** (done): Vite + Hono + local D1, `/api/health`, i18n, tests, lint and formatting.
1. Installable PWA: manifest, icons, service worker, offline shell (done).
2. D1 schema, expenses and default categories: API and UI (done).
3. Offline queue and sync (done).
4. Google login and per-user data.
5. Custom categories (create, edit, delete).
6. Visual identity and transitions.
7. CI and husky (done), then Cloudflare deployment.

## 12. Discarded and open decisions

Discarded:

- **Next.js 16**: SSR and RSC would go unused and, on Workers, it needs the OpenNext adapter.
- **React Router 7 in framework mode**: its `loader`/`action` assume the network.
- **Cloudflare Pages**: in maintenance.
- **Cuadra, Menudo, Tally, Slate, Tab** as a name: taken on `.app`, `.dev` and `.com`.

Open:

- Locales beyond `en` and `es` (`spa-anicalendar` also ships `fr` and `de`).
- Better Auth or another option for the login.
- Domain: `tarja.dev` is available (2026-10-25) but costs money, which clashes with "free tiers only"; `tarja.app` and `tarja.com` are taken. The free path is `workers.dev`.
- D1 `database_id` on the first deploy: create the database with `wrangler d1 create` or let Wrangler provision it.
- Whether to approve pnpm's "agent skills".
