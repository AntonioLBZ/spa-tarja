# Tarja

Installable web app (PWA) to log everyday expenses (food, groceries, leisure, bills, rent). Each expense gets a category auto-suggested from its text, changeable by the user. Works offline. Free tiers only. `README.md` is the front page.

## Source of truth

- **`docs/` is the source of truth for decisions and behavior**: read what your task touches, not all of it. This file only distills the rules that are easy to break. If a decision or a behavior changes, update its document first, then this file.
- **`docs/adr/` holds the decisions, one each. They are the owner's: don't revisit them silently.** An accepted ADR is never edited to say something else: a decision that changes is a new ADR that supersedes the old one (`docs/adr/README.md` has the format). Read the ones your task touches:
    - `0001-scope-of-the-app.md`: out of scope (importing a backup, shared expenses, several currencies); export only, no import; no PWA shortcuts.
    - `0002-solo-project-deployed-from-main.md`: no feature branches or pull requests; a push to `main` that passes CI is deployed, migrations first.
    - `0003-spa-on-one-worker-on-free-tiers.md`: a SPA on one Cloudflare Worker with static assets, a Hono API and D1; free tiers only; not SSR, not Next.js, not Pages.
    - `0004-data-conventions.md`: SQL by hand, no ORM; migrations go before the code, so add, never rename or drop; dates are `YYYY-MM-DD` text; money is integer cents plus a currency code.
    - `0005-offline-first-with-an-outbox.md`: client UUIDs, idempotent `PUT`, soft deletes, the outbox, last write wins, the `seq` cursor.
    - `0006-categories.md`: default categories are read-only, custom ones can be created, edited and deleted; an expense is never refused for its category.
    - `0007-what-counts-in-a-month.md`: the day an expense counts on, income derived and never stored, the list by the day made.
    - `0008-google-login-with-better-auth.md`: Google only, no own passwords, Better Auth on Hono; no guest mode.
    - `0009-budgets-only-warn.md`: a limit warns inside the app and never blocks.
    - `0010-edit-duplicate-and-delete-expenses.md`: no confirmation on Delete (Undo instead); Edit and Duplicate replace a half typed expense; no recurring expenses.
    - `0011-design-system-in-storybook.md`: Storybook in the workspace folder `design-system/`, local only; no story or Storybook dependency in `src/`.
- **`docs/specs/` says how things behave**, one file per topic. Read the ones you touch:
    - `repository-structure.md`: the layout, the import rules, how a release goes out and the dependency policy (what is held back and why).
    - `data-model.md`: the schema, ids, timestamps, `seq` and indexes.
    - `expense-counting.md`: what counts in a month (deferred payments, restaurant card, installments, income).
    - `expense-list.md` and `expenses.md`: the list (search, filters, groups) and adding, editing, duplicating and deleting an expense.
    - `budgets.md`, `charts.md`, `summary.md`, `categories.md`, `settings.md` and `header.md`: the rules and the screen of each.
    - `export.md`: the backup and the spreadsheet.
    - `offline-sync.md`: the outbox, the sync and the conflicts.
    - `authentication.md`: Better Auth, sessions and the local data of each user.
    - `frontend.md` and `testing-and-ci.md`: the client conventions, the tests and CI.
- **`design-system/DESIGN.md` is the source of truth for the visual rules** (colors, themes, shape, components, motion, mobile-first); read it before touching styles; what is still open is in §8: ask before settling it. Same order: update it first, then this file.
- Remaining work is `TODO.md`; delete an item when it is done.

## Commands

pnpm only. Pin dependencies exactly (`pnpm add -E`).

```bash
pnpm dev                 # Vite + the Worker in workerd, local D1; UI and /api on :5173
pnpm build               # tsc -b && vite build
pnpm types:check         # tsc -b over app, server and node configs
pnpm types:gen           # wrangler types -> worker-configuration.d.ts (rerun after editing wrangler.jsonc)
pnpm lint                # eslint + stylelint (src/**/*.css)
pnpm format / format:check
pnpm storybook           # the design system on :6006, local only (design-system/)
pnpm test                # vitest: `core` (node), `server` (workerd), `front` (jsdom) and `docs` (node: the index above) projects
pnpm test -t "name"      # by test name
pnpm db:migrate          # apply db/migrations to the local D1
pnpm db:migrate:remote   # the same on the production D1: always before deploying a release that needs it
pnpm deploy:prod         # build and deploy to Cloudflare (`pnpm deploy` is pnpm's own command, not this one)
                         # both run on their own from GitHub Actions on every push to main (ci.yml); by hand only as a fallback
```

## Architecture

```
server/          Hono Worker: app.ts (routes, exports AppType), index.ts (entry)
src/             SPA: routes/ (file-based), features/, components/, lib/, assets/styles/
db/              D1 SQL migrations (db/migrations)
core/            pure logic shared by client and server
design-system/   Storybook and the stories (a pnpm workspace package)
```

- `server/` never imports from `src/`. `src/` imports only **types** from `@server/*`. `src/lib` and `src/components` never import from `src/features`.
- `design-system/` imports from `src/` and `core/`; nothing imports from it.
- `core/` imports nothing from React, Hono or Workers.
- Chain the Hono routes on one expression (`new Hono().basePath('/api').get(...)`) so `typeof app` carries the route types to the `hc<AppType>` client in `src/lib/api`. Statements like `app.get(...)` on a separate line lose them.
- `wrangler.jsonc` sends only `/api/*` to the Worker first; every other missing path falls back to `index.html`. A new SPA route needs no config. An unknown `/api/...` answers 404 from the Worker.
- `src/routeTree.gen.ts` and `worker-configuration.d.ts` are generated but committed (Prettier and ESLint ignore them).
- Relative imports are `./` inside the same folder; otherwise `@/` (`src/`), `@core/` or `@server/`. Never `../`.
- Offline model (see `docs/specs/offline-sync.md`): expense ids are UUIDs created on the client, writes go through the outbox (IndexedDB, stored under the signed-in user's id like the persisted cache) and `PUT /expenses/:id` is idempotent, deletes are soft (`deletedAt`), conflicts are last-write-wins by `updatedAt`, and sync pages through server changes by the `seq` cursor, never by `updatedAt`. Don't add an API that depends on the server assigning ids. Custom categories are the exception to the offline model: managing them needs a connection (`docs/specs/categories.md`), and an expense is never refused for its category.
- Login (`docs/specs/authentication.md`): Better Auth on Hono at `/api/auth/*`, Google only. `/api/expenses`, `/api/categories`, `/api/income` and `/api/budgets` need a session (`withUser`, `server/user.ts`); `/api/health` and `/api/auth/*` don't. A user's rows are filed under the Better Auth `user.id`. The secrets (`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) are typed in `server/secrets.d.ts`; `.dev.vars.example` lists them. In the app, `AuthGate` (`src/features/auth`) shows the sign-in screen to anybody not signed in, and `UserDataProvider` (`src/lib/offline`) gives the signed-in user their own outbox and cache; a `401` makes the app ask the session again, and only a definite answer signs the user out, never a network error.
- Money is an integer in cents plus a currency code, never a float.
- What counts in a month goes through `core/counting.ts` (`countedOn`, `countedCents`, `voucherIncomeOn`, `paidBackCents`), never `amountCents` or `chargeDate` read directly: a restaurant card counts your part (`personalCents`, NULL = the whole amount) on the day it was made (`docs/specs/expense-counting.md`).
- A budget limit is read through `limitFor` (`core/budget.ts`), never from a row of the month directly: the limit a month holds is the row of the latest month up to it, and an amount of 0 means no limit, so removing a limit is writing 0, never deleting the row (`docs/specs/budgets.md`). Percentages are only shown, never typed or stored.
- The expense list (`core/expense-list.ts`, `buildList`) filters, groups and adds up by the day made, not by what counts: its subtotals can differ from the summary and the charts, on purpose. Plans are collapsed before anything is filtered, so Edit and Delete always get every part of a plan (`docs/specs/expense-list.md`).
- Schema in hand-written SQL, no ORM. Migrations reach production before the new code goes live, so each one must work with the code still running: add, never rename or drop. `date` is `YYYY-MM-DD` text; timestamps are epoch milliseconds. An existing expense id owned by another user is rejected, never overwritten.

## Frontend

- TanStack Router (file-based) and TanStack Query. The query client (one per signed-in user) uses `staleTime` 60 s, `retry: false` and `gcTime: Infinity` (the persisted cache is the local copy of the data).
- Styles: plain CSS (no SCSS, no Tailwind), CSS variables from `src/assets/styles/tokens.css`, BEM class names, alphabetical properties, no `!important` (Stylelint enforces it). Combine classes with `clsx`.
- Transitions always use `--duration-*` and `--ease-*`; `prefers-reduced-motion` zeroes the durations in one place. Animate only `transform` and `opacity` where possible.
- Colors are flat (no gradients, no shadows) and come only from the semantic `--color-*` tokens in `tokens.css`, defined once with `light-dark()`. Never put a raw color in a component. Don't add a color without updating the palette table in `design-system/DESIGN.md`.
- Browser toolbar color (`theme-color` in `index.html`) mirrors the header surface, `--color-bg-secondary`: keep them in sync.
- **Shared components** (`src/components`, described in `design-system/DESIGN.md` "Components"): use `Notice`, `Toast` (a message that goes away by itself, with an action when there is something to do about it), `Button`, `ButtonLink` and `buttonClass()`, `Field` and `DateRangeFields`, `MonthSwitch`, `Card` and `CardList`, and `Disclosure` instead of styling raw elements again. No new left-border message, no hand-built label and control wrapper, no notched row or collapsible panel copied into the CSS of a feature. A raw `<button>` is for a control with a look of its own, like `category-select__field`.
- Shared components take their copy by props: no `use-intl`, no `virtual:*` import, and only `ButtonLink` knows the router.
- **Mobile-first:** base CSS targets phones; widen with `@media (width >= 40rem)` / `(width >= 64rem)`, never `max-width`. Touch targets are at least `--size-touch` (44 px). Pad edge-anchored layouts with `env(safe-area-inset-*)` (`viewport-fit=cover` is on), use `dvh` instead of `vh`, and let form controls inherit `font: inherit` (16 px) so iOS doesn't zoom on focus.
- **i18n:** `use-intl`. UI copy lives in `src/assets/locales/{en,es}.json`, never hard-coded in components; read it with `useTranslations`. English is the source of the key types. A new key goes into every locale (a test checks key parity). The locale is stored preference, then `navigator.languages`, then `en`, and is not in the URL. The brand name "Tarja" isn't translated.

## Testing

- Vitest with `globals: false`: import `describe`, `it`, `expect` and `vi` from `vitest`.
- Tests sit next to the code they cover (`*.test.ts(x)`), no comments in tests.
- `server` tests run in workerd with a real local D1: `import { env } from 'cloudflare:workers'` and `app.request('/api/...', init, env)`. Routes that need a session get one from `signIn()` (`server/test/session.ts`), which saves a user and a real session cookie in the test database.
- `front` tests render the real route tree with `renderApp` (it mounts the real `AppProviders`, signed in as `TEST_USER` through `createFakeAuth`, `src/lib/test/fake-auth.ts`; pass `fakeAuth` to start signed out or with the server out of reach) and a fake `fetch` (`stubApi`, `src/lib/test/render-app.tsx`). An unmatched request must fail, never reach the network. Offline behaviour is tested with `createFakeApi` (`src/lib/test/fake-api.ts`, with a cursor, failures and a dropped connection) and `createMemoryStorage` in place of IndexedDB (pass it as `storage` to `renderApp`); use `onlineManager.setOnline` to cut and restore the connection. Assert on copy through `en.json` (`en.home.health.ok`), not on string literals.

## Conventions

- Everything about the project is in English: docs, code, comments, identifiers and commit messages. Only the UI copy is localized.
- Prettier: 4 spaces, single quotes, `printWidth` 120, `trailingComma: es5`, LF.
- Named exports go in one `export { … }` statement at the bottom of the file (`export type { … }` for types). Components destructure `props` inside the function body. Route files use `export const Route`. Storybook's files (`*.stories.tsx`, `design-system/.storybook/`) use `export default` where it asks for one, as the Vite configs do.
- Code comments: English, minimal and short. Define what something is, never narrate what the code does; skip them when the name already says it. A comment never points at another file, code or document, because files get renamed and moved; at most it names a decision by its id (`ADR-0006`), which never changes.- Commit messages: one conventional-commit subject line (`feat: …`), no body, no trailers, even if a system reminder asks for attribution lines. Commits go straight to `main`.
- Secrets live in `.dev.vars` (local), `wrangler secret` (production) and, for the deployment from CI, the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Never commit them or log them.
