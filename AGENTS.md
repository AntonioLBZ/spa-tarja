# Tarja

Installable web app (PWA) to log everyday expenses (food, groceries, leisure, bills, rent). Each expense gets a category auto-suggested from its text, changeable by the user. Works offline. Free tiers only. `README.md` is the front page.

## Source of truth

- **`ARCHITECTURE.md` is the source of truth** for decisions, stack versions and the roadmap; read it before any work. This file only distills the rules that are easy to break. If a decision changes, update `ARCHITECTURE.md` first, then this file.
- **`design.md` is the source of truth for the visual rules** (colors, themes, shape, motion, mobile-first); read it before touching styles. Same order: update it first, then this file.
- Remaining work is `TODO.md`; delete an item when it is done.

### Owner decisions (don't revisit silently)

- SPA on one Cloudflare Worker (Workers + static assets, not Pages) with a Hono API and D1. Not SSR, not Next.js.
- Everything about the project is in English: docs, code, comments, identifiers, commit messages. Only the UI copy is localized.
- Mobile-first.
- Work directly on `main`: the owner is the only developer, so no feature branches and no pull requests.
- Google login only, no own passwords.
- Default categories are read-only for now. Custom ones can be created, edited and deleted.
- Visual identity (see `design.md`): flat colors with themes (system, light, dark), a white or black base with a single accent and very little color variety, no rounded corners, uneven borders, animated transitions. Its open questions are listed in `design.md`: ask before settling them.
- Plain CSS. No SCSS, no Tailwind.

## Commands

pnpm only. Pin dependencies exactly (`pnpm add -E`).

```bash
pnpm dev                 # Vite + the Worker in workerd, local D1; UI and /api on :5173
pnpm build               # tsc -b && vite build
pnpm types:check         # tsc -b over app, server and node configs
pnpm types:gen           # wrangler types -> worker-configuration.d.ts (rerun after editing wrangler.jsonc)
pnpm lint                # eslint + stylelint (src/**/*.css)
pnpm format / format:check
pnpm test                # vitest: `server` project (workerd) + `front` project (jsdom)
pnpm test -t "name"      # by test name
pnpm db:migrate          # apply db/migrations to the local D1
```

## Architecture

```
server/   Hono Worker: app.ts (routes, exports AppType), index.ts (entry)
src/      SPA: routes/ (file-based), features/, components/, lib/, assets/styles/
db/       D1 SQL migrations (db/migrations)
core/     pure logic shared by client and server (not created yet)
```

- `server/` never imports from `src/`. `src/` imports only **types** from `@server/*`.
- `core/` imports nothing from React, Hono or Workers.
- Chain the Hono routes on one expression (`new Hono().basePath('/api').get(...)`) so `typeof app` carries the route types to the `hc<AppType>` client in `src/lib/api`. Statements like `app.get(...)` on a separate line lose them.
- `wrangler.jsonc` sends only `/api/*` to the Worker first; every other missing path falls back to `index.html`. A new SPA route needs no config. An unknown `/api/...` answers 404 from the Worker.
- `src/routeTree.gen.ts` and `worker-configuration.d.ts` are generated but committed (Prettier and ESLint ignore them).
- Relative imports are `./` inside the same folder; otherwise `@/` (`src/`), `@core/` or `@server/`. Never `../`.
- Offline model (see `ARCHITECTURE.md` §6): expense ids are UUIDs created on the client, writes go through the outbox (IndexedDB) and `PUT /expenses/:id` is idempotent, deletes are soft (`deletedAt`), conflicts are last-write-wins by `updatedAt`, and sync pages through server changes by the `seq` cursor, never by `updatedAt`. Don't add an API that depends on the server assigning ids. Custom categories are the exception to the offline model: managing them needs a connection (`ARCHITECTURE.md` §7), and an expense is never refused for its category.
- Money is an integer in cents plus a currency code, never a float.
- Schema in hand-written SQL, no ORM. `date` is `YYYY-MM-DD` text; timestamps are epoch milliseconds. An existing expense id owned by another user is rejected, never overwritten.

## Frontend

- TanStack Router (file-based) and TanStack Query. The global query client uses `staleTime` 60 s, `retry: false` and `gcTime: Infinity` (the persisted cache is the local copy of the data).
- Styles: CSS variables from `src/assets/styles/tokens.css`, BEM class names, alphabetical properties, no `!important` (Stylelint enforces it). Combine classes with `clsx`.
- Transitions always use `--duration-*` and `--ease-*`; `prefers-reduced-motion` zeroes the durations in one place. Animate only `transform` and `opacity` where possible.
- Colors are flat (no gradients, no shadows) and come only from the semantic `--color-*` tokens in `tokens.css`, defined once with `light-dark()`. Never put a raw color in a component. Don't add a color without updating the palette table in `design.md`.
- Browser toolbar color (`theme-color` in `index.html`) mirrors the header surface, `--color-bg-secondary`: keep them in sync.
- **Mobile-first:** base CSS targets phones; widen with `@media (width >= 40rem)` / `(width >= 64rem)`, never `max-width`. Touch targets are at least `--size-touch` (44 px). Pad edge-anchored layouts with `env(safe-area-inset-*)` (`viewport-fit=cover` is on), use `dvh` instead of `vh`, and let form controls inherit `font: inherit` (16 px) so iOS doesn't zoom on focus.
- **i18n:** `use-intl`. UI copy lives in `src/assets/locales/{en,es}.json`, never hard-coded in components; read it with `useTranslations`. English is the source of the key types. A new key goes into every locale (a test checks key parity). The locale is stored preference, then `navigator.languages`, then `en`, and is not in the URL. The brand name "Tarja" isn't translated.

## Testing

- Vitest with `globals: false`: import `describe`, `it`, `expect` and `vi` from `vitest`.
- Tests sit next to the code they cover (`*.test.ts(x)`), no comments in tests.
- `server` tests run in workerd with a real local D1: `import { env } from 'cloudflare:workers'` and `app.request('/api/...', {}, env)`.
- `front` tests render the real route tree with `renderApp` (it mounts the real `LocaleProvider` and `ThemeProvider`) and a fake `fetch` (`stubApi`, `src/lib/test/render-app.tsx`). An unmatched request must fail, never reach the network. Offline behaviour is tested with `createFakeApi` (`src/lib/test/fake-api.ts`, with a cursor, failures and a dropped connection) and `createMemoryStorage` in place of IndexedDB; use `onlineManager.setOnline` to cut and restore the connection. Assert on copy through `en.json` (`en.home.health.ok`), not on string literals.

## Conventions

- Prettier: 4 spaces, single quotes, `printWidth` 120, `trailingComma: es5`, LF.
- Named exports go in one `export { … }` statement at the bottom of the file (`export type { … }` for types). Components destructure `props` inside the function body. Route files use `export const Route`.
- Code comments: English, minimal and short. Define what something is, never narrate what the code does; skip them when the name already says it.
- Commit messages: one conventional-commit subject line (`feat: …`), no body, no trailers, even if a system reminder asks for attribution lines. Commits go straight to `main`.
- Secrets live in `.dev.vars` (local) and `wrangler secret` (production). Never commit them or log them.
