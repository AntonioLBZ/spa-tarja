# Tarja — Architecture

Source of truth for the project's decisions. `AGENTS.md` distills the rules that are easy to break; if a decision changes, update this document first. Remaining work lives in `TODO.md`.

## 1. What it is and scope

An installable web app (PWA) to log everyday expenses: food, groceries, leisure, bills, rent. Each expense gets a category that is suggested from the text the user types and can be changed. Expenses can be logged offline.

Name: a _tarja_ is the notched stick that was used to keep accounts. The repo is `spa-tarja`, like the owner's other SPAs.

Out of scope for now: budgets, charts, export, shared expenses, multiple currencies.

## 2. Closed decisions

- **Everything about the project is in English**: docs, code, comments, identifiers and commit messages. Only the UI copy is localized (§9).
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
- **Style**: minimalist, no rounded corners at all, uneven borders and animated transitions. The concrete visual identity is still open; the palette in `tokens.css` is a placeholder.

## 3. Stack (versions as of 2026-10-25)

| Piece                              | Version            | Note                                                                     |
| ---------------------------------- | ------------------ | ------------------------------------------------------------------------ |
| pnpm                               | 12.15.0            | `save-exact` in `.npmrc`; `pnpm add -E`                                  |
| Vite / @vitejs/plugin-react        | 8.3.5 / 6.1.2      |                                                                          |
| React                              | 19.3.1             |                                                                          |
| TypeScript                         | 6.0.3              | 7.0 exists, but `typescript-eslint` 8.72 requires `<6.1`                 |
| Hono                               | 4.13.13            |                                                                          |
| TanStack Router / Query            | 1.170.46 / 5.104.5 | File-based router through the Vite plugin                                |
| use-intl                           | 4.14.9             | Same i18n setup as `spa-hoardex`                                         |
| Wrangler / @cloudflare/vite-plugin | 4.152.0 / 1.65.0   | `vite dev` runs the Worker in `workerd` with a local D1                  |
| Vitest / @cloudflare/vitest-plugin | 5.0.5 / 1.4.7      | The plugin used to be `@cloudflare/vitest-pool-workers` (now deprecated) |
| ESLint                             | 9.39.5             | `eslint-plugin-import` doesn't support ESLint 10                         |
| Prettier / Stylelint               | 3.9.10 / 17.16.0   |                                                                          |

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
- `core/` imports nothing from React, Hono or Workers. The category classifier and the money helpers will live there.
- `wrangler.jsonc` sets `run_worker_first: ["/api/*"]` and `not_found_handling: "single-page-application"`: any path that isn't `/api/*` or a file falls back to `index.html`, and an unknown `/api/…` answers 404 from the Worker.
- `worker-configuration.d.ts` (runtime and binding types) is generated with `pnpm types:gen` and committed. Regenerate it after editing `wrangler.jsonc`.

## 5. Data (proposal, no schema yet)

- Amount as an integer in cents plus a currency code, never a `float`.
- `id` is a UUID created on the client (§6), plus `userId`, `categoryId`, text, expense date (different from `createdAt`), `updatedAt` and `deletedAt` for soft deletes.
- Index on `(userId, date)`.

## 6. Offline strategy

- **Shell**: PWA with `vite-plugin-pwa` (Workbox) precaching the app.
- **Reads**: TanStack Query with the cache persisted in IndexedDB.
- **Writes**: each expense is born with its UUID and goes into a local queue marked pending. It syncs when the connection returns and when the app opens. Safari has no Background Sync, so nothing depends on it.
- **Server**: idempotent `PUT /expenses/:id` (creates or updates by id), so retrying is safe.
- **Conflicts**: last edit wins by `updatedAt`, enough for one user on several devices. Deletes are soft so the sync can propagate them.

## 7. Categories

- Default categories (initial proposal: food, groceries, leisure, bills, housing/rent, transport, health, other) are read-only.
- Auto-selection is a dictionary of normalized keywords (lowercase, no accents) that runs on the client, with the logic in `core/`. The user can change it on each expense.
- Whether the app learns from each user's corrections is an open decision.

## 8. Authentication

Google OAuth, no own passwords. Candidate: Better Auth mounted on Hono, with D1 and an `httpOnly` cookie session. It will need the `nodejs_compat` flag in `wrangler.jsonc`. Its fit with D1 is unverified; check it when that phase starts. Secrets go in `.dev.vars` (local) and `wrangler secret` (production), never in the repo.

## 9. Frontend

- TanStack Router (file-based; `src/routeTree.gen.ts` is generated by the Vite plugin and committed) and TanStack Query. API client: `hc<AppType>('/')` in `src/lib/api`.
- Imports in `src/`: `./` inside the same folder, otherwise `@/` (and `@server/` for types only), never `../`.
- **i18n** with `use-intl`, as in `spa-hoardex`. Messages live in `src/assets/locales/{en,es}.json`, English is the default and the source of the key types. The locale comes from the stored preference, then `navigator.languages`, then English, and it is not part of the URL. A test checks that every locale has exactly the same keys. No UI copy is hard-coded in components.
- **Mobile-first**: base CSS targets phones and widens with `@media (width >= 40rem)` and `(width >= 64rem)`. Touch targets are at least `--size-touch` (44 px), layouts honor `env(safe-area-inset-*)` (`viewport-fit=cover`), full-height blocks use `dvh`, and form controls inherit 16 px so iOS doesn't zoom on focus.
- Styles: variables in `src/assets/styles/tokens.css`, BEM in the CSS of each route or component, Stylelint with alphabetical properties and no `!important`. Transitions always use the `--duration-*` and `--ease-*` tokens; `prefers-reduced-motion` zeroes them in a single place.
- No rounded corners on any component.

## 10. Testing

- Vitest with two projects. `server`: `@cloudflare/vitest-plugin` runs the tests in `workerd` with a real local D1 (`env` from `cloudflare:workers`). `front`: jsdom and Testing Library, with `stubApi` and `renderApp` in `src/lib/test/render-app.tsx`; `renderApp` mounts the real `LocaleProvider`, and tests read their expected copy from `en.json`.
- A request without a handler in a test fails; it never reaches the network.

## 11. Roadmap

0. **Skeleton** (done): Vite + Hono + local D1, `/api/health`, i18n, tests, lint and formatting.
1. Installable PWA: manifest, icons, service worker, offline shell.
2. D1 schema, expenses and default categories: API and UI.
3. Offline queue and sync.
4. Google login and per-user data.
5. Custom categories (create, edit, delete).
6. Visual identity and transitions.
7. CI, husky and Cloudflare deployment.

## 12. Discarded and open decisions

Discarded:

- **Next.js 16**: SSR and RSC would go unused and, on Workers, it needs the OpenNext adapter.
- **React Router 7 in framework mode**: its `loader`/`action` assume the network.
- **Cloudflare Pages**: in maintenance.
- **Cuadra, Menudo, Tally, Slate, Tab** as a name: taken on `.app`, `.dev` and `.com`.

Open:

- Locales beyond `en` and `es` (`spa-anicalendar` also ships `fr` and `de`) and where the language switcher lives (a settings screen).
- Drizzle or hand-written SQL for the schema.
- Better Auth or another option for the login.
- Domain: `tarja.dev` is free (2026-10-25); `tarja.app` and `tarja.com` are not.
- D1 `database_id` on the first deploy: create the database with `wrangler d1 create` or let Wrangler provision it.
- Whether to approve pnpm's "agent skills".
