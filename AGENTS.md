# Tarja

Installable web app (PWA) to log everyday expenses (food, groceries, leisure, bills, rent) and split them with other people in groups. Each expense gets a category auto-suggested from its text, changeable by the user. Works offline. Free tiers only. `README.md` is the front page.

## Source of truth

- **`docs/` is the source of truth**: the decisions in `docs/adr/` (one each, the why), how things behave in `docs/specs/` (one file per topic), the visual rules in `design-system/DESIGN.md`. This file only distills the rules that are easy to break. When a decision or a behavior changes, update its document first, then this file if one of its rules changes.
- **Find what your task touches with the `find-docs` skill, don't read `docs/` whole**: `node .agents/skills/find-docs/find.mjs src/lib/offline` (a file of code), `… settle` (words), `… 16` (an ADR).
- **The ADRs are the owner's: don't revisit them silently.** An accepted one is never edited to say something else; a change is a new ADR that supersedes or refines it, and the later one wins where they disagree (`docs/adr/README.md`).
- Read `design-system/DESIGN.md` before touching styles; what is still open is in its §8: ask before settling it.
- Remaining work is `TODO.md`; delete an item when it is done.

## Commands

pnpm only. Pin dependencies exactly (`pnpm add -E`).

```bash
pnpm dev                 # Vite + the Worker in workerd, local D1; UI and /api on :5173
pnpm build               # tsc -b && vite build
pnpm types:check         # tsc -b over app, server and node configs
pnpm types:gen           # wrangler types -> worker-configuration.d.ts (rerun after editing wrangler.jsonc, with .dev.vars moved aside: it adds the secrets)
pnpm lint / lint:fix     # eslint + stylelint (src/**/*.css and design-system/stories/**/*.css)
pnpm format / format:check
pnpm storybook           # the design system on :6006, local only (design-system/)
pnpm test                # vitest: `core` (node), `server` (workerd), `front` (jsdom) and `docs` (node: the front matter of the docs, `_headers`, the deploy workflows and the push worker) projects
pnpm test -t "name"      # by test name
pnpm test --project front path/to/file.test.tsx   # one project, one file
pnpm preview             # serve the build: the only way to try `public/_headers` (the CSP)
pnpm db:migrate          # apply db/migrations to the local D1
pnpm db:migrate:remote   # the same on the production D1: always before deploying a release that needs it
pnpm deploy:prod         # build and deploy to Cloudflare (`pnpm deploy` is pnpm's own command, not this one)
                         # CI runs both on a release (Deploys, below); by hand only as a fallback
pnpm db:migrate:prerelease  # the same on the prerelease D1
pnpm deploy:prerelease   # build, migrate and deploy the prerelease Worker; GitHub Actions runs it for any branch but main
```

The Husky pre-commit hook runs `format:check`, `types:check`, `lint` and `test`, the same checks as CI (which also builds), so a commit takes a while and fails on any of them.

## Architecture

```
server/          Hono Worker: app.ts (routes, exports AppType), index.ts (entry); the rest in folders by theme
src/             SPA: routes/ (file-based), features/, components/, lib/, assets/ (styles, locales)
db/              D1 SQL migrations (db/migrations)
core/            pure logic shared by client and server, in folders by theme
design-system/   Storybook and the stories (a pnpm workspace package)
public/          static files, _headers (security headers and CSP), robots.txt
```

What each folder holds is in `docs/specs/repository-structure.md`.

- **Imports.** `server/` never imports from `src/`. `src/` imports only **types** from `@server/*`. `src/lib` and `src/components` never import from `src/features`. `design-system/` imports from `src/` and `core/`; nothing imports from it. `core/` imports nothing from React, Hono or Workers. `src/lib/<subject>` is imported through its `index.ts` (`@/lib/offline`; `testing` has none, file by file); `core/`, `server/` and a feature are imported file by file (`@core/basics/money`, `@server/auth/user`, `@/features/profile/profile`). Relative imports are `./` inside the same folder; otherwise `@/` (`src/`), `@core/` or `@server/`. Never `../`.
- **Routes.** Chain the Hono routes on one expression (`new Hono().basePath('/api').get(...)`) so `typeof app` carries the route types to the `hc<AppType>` client in `src/lib/api`; a route added in a statement of its own loses them. `wrangler.jsonc` sends only `/api/*` to the Worker first, every other missing path falls back to `index.html` (a new SPA route needs no config), and an unknown `/api/...` answers 404 from the Worker.
- **Generated but committed**: `src/routeTree.gen.ts` and `worker-configuration.d.ts` (Prettier and ESLint ignore them). The service worker's push script (`src/features/notices/push-worker.ts`) is built apart, as a classic script, by `push-worker.config.ts`.
- **Deploys and versions** (ADR-0015, ADR-0040, `docs/specs/repository-structure.md`): a push to `main` deploys production (migrations first, then a GitHub Release) only when the `version` of `package.json` has no release yet, so only the push of a `chore: release x.y.z` commit deploys, and that commit is made only when the owner asks; any other branch deploys the prerelease Worker (`tarja-prerelease`, its own D1, secrets and Google client). The Worker has no Git connection in Cloudflare. Never run `wrangler deploy --env prerelease` after a normal build: that output binds the production database; `pnpm deploy:prerelease` rebuilds with `CLOUDFLARE_ENV=prerelease`, and the `d1` commands need `--env prerelease` too. `appVersion` (`src/lib/app-info/version.ts`) is the one place that reads the version; production's build leaves the commit out on purpose.
- **Data** (ADR-0004, `docs/specs/data-model.md`): schema in hand-written SQL, no ORM. Migrations reach production before the new code, so each one works with the code still running: add, never rename or drop. `date` is `YYYY-MM-DD` text, timestamps are epoch milliseconds, money is an integer in cents plus a currency code, never a float. An existing id owned by another user is rejected, never overwritten.
- **Offline** (ADR-0005, ADR-0013, `docs/specs/offline-sync.md`): ids are UUIDs made on the client, writes go through an outbox (IndexedDB, under the signed-in user's id, like the persisted cache) to an idempotent `PUT`, deletes are soft (`deletedAt`), conflicts are last-write-wins by `updatedAt`, and sync pages by the `seq` cursor, never by `updatedAt`. Don't add an API that depends on the server assigning ids. Shared entries have a second outbox with a `seq` per group. What needs a connection (custom categories; anything that shapes a group: groups, members, invitations, the nickname, the simplified debts switch) is refused on the device before anything is sent. An expense is never refused for its category.
- **What adds up**: what counts in a month goes through `core/expenses/counting.ts` (`countedOn`, `countedCents`, …), never `amountCents` or `chargeDate` read directly (`docs/specs/expense-counting.md`); a budget limit is read through `limitFor` (`core/budgets/budget.ts`), 0 means no limit and removing one writes 0 (`docs/specs/budgets.md`); the expense list (`buildList`) groups and adds up by the day made, so its subtotals can differ from the summary and the charts on purpose (`docs/specs/expense-list.md`).
- **Login** (ADR-0008, `docs/specs/authentication.md`): Better Auth on Hono at `/api/auth/*`, Google only; neither its tokens nor the address of the picture is ever kept. A write to `/api` outside `/api/auth/*` from another `Origin` is `403 bad-origin`. Every route that needs a session goes through `withUser` (`server/auth/user.ts`), which also reads the `user` row and checks `X-Tarja-User` (`401 other-user`). Only a definite answer signs the user out, never a network error, and the local copy is deleted only if both outboxes are empty. **The privacy notice says only what the code does**: a change to what is stored, logged or sent to a third party changes `privacy.*` and its "last updated" date in both locales in the same commit (`docs/specs/settings.md`). Secrets are typed in `server/secrets.d.ts` and listed in `.dev.vars.example`.
- **Shared expenses** (ADR-0012 to ADR-0014): read `groups.md`, `shared-expenses.md`, `balances.md` and `invitations.md` before touching `core/groups/`, `src/features/groups/` or `/api/groups/*`; the rules that cross files:
    - Entries belong to the group and name people by member, never by user id; never write another user's `expenses` row. Your part reaches the lists as derived rows (`useYourExpenses`); `useExpenses` stays the person's own, so no shared row reaches the personal outbox or the `expenses` of the JSON.
    - Nothing about people is deleted or rewritten: a member leaves (`left_at`), a dummy merged into a user is an alias (`merged_into`, read through `canonicalMember`).
    - Splits, balances and debts are worked out in cents by `core/groups/`, the same code on the server; the shares are stored, never a percentage, and simplified debts are a view, never a rewrite.
    - Every `/api/groups/*` route answers a non-member the same `404` as a missing group, and every way an invitation link can't be used the same `410 gone`; its token never goes in the URL of an API call.
- **Notifications** (ADR-0025, `docs/specs/notifications.md`): what is told is decided once, by `noticesFor` (`core/groups/notices.ts`), for the banner and the push alike.

## Frontend

- TanStack Router (file-based) and TanStack Query, one query client per signed-in user (`docs/specs/frontend.md`).
- **Styles**: plain CSS (no SCSS, no Tailwind), CSS variables from `src/assets/styles/tokens.css`, BEM class names, alphabetical properties, no `!important` (Stylelint enforces it). Combine classes with `clsx`. Transitions use `--duration-*` and `--ease-*` (`prefers-reduced-motion` zeroes the durations in one place) and animate `transform` and `opacity` where possible.
- **Colors** are flat (no gradients) and come only from the semantic `--color-*` tokens, defined once with `light-dark()`. The only shadow is `--shadow-popup`, for what opens over the page and where content scrolls under an edge (ADR-0018). Never a raw color in a component, except the system colors of a `@media (forced-colors: active)` block at the end of its CSS. A new color updates the palette table of `design-system/DESIGN.md`. The `theme-color` of `index.html` mirrors `--color-bg-secondary`.
- **The policy of the pages** (`public/_headers`, pinned by `docs/test/headers.test.ts`): `default-src 'self'`, so nothing from another origin, no `eval`, no `<style>` element or `style="…"` attribute, no inline `<script>` but the theme one of `index.html`. A custom property from React (`style={{ '--x': 1 }}`) is fine. The build writes the hash of the inline script itself (`csp.config.ts`); never copy it by hand. A change to what a page may load changes the policy and its test in the same commit; try it on `pnpm build` + `pnpm preview`, since `pnpm dev` doesn't read `_headers`.
- **The header hides on scroll** by `transform` only (`docs/specs/header.md`): never take it out of the page or the tab order (no `display`, `visibility`, `inert`, `aria-hidden`). Scrollbars are styled only under `@media (pointer: fine)` in `base.css`; never `scrollbar-width: none`, never one drawn by script.
- **Screens** (`docs/specs/frontend.md`): every `h1` is a `ScreenTitle`, never a bare `<h1>`. A message that comes and goes goes in a `LiveNotice` (a live region always in the page); something with no place on screen is said with `useAnnounce`; what changes with every key is read out debounced.
- **Shared components** (`src/components`, each described in `design-system/DESIGN.md` "Components"; look there before building UI). Use them instead of styling raw elements again: no left-border message, hand-built label and control wrapper, notched row, collapsible panel or modal in the CSS of a feature. An action inside a `Toast` or on a `Sheet` is a `ghost` `Button` (no L inside an L). A list of options is a `Select`, never a `<select>` styled in a feature nor a list built by hand. A raw `<button>` is for a control with a look of its own. A quiet hint takes the class `hint`; heading sizes come from `base.css`. Shared components take their copy by props (no `use-intl`, no `virtual:*` import), and only the links (`ButtonLink`, `TabLink`, `BottomNav`) know the router. A new shared component comes with its folder of stories (Conventions); a new token needs none.
- **Mobile-first**: base CSS targets phones (below 40 rem the destinations are a bottom bar, and anything anchored to the bottom sits above it); widen with `@media (width >= 40rem)` / `(width >= 64rem)`, never `max-width`. Touch targets are at least `--size-touch` (44 px). Pad edge-anchored layouts with `env(safe-area-inset-*)`, use `dvh` instead of `vh`, and let form controls inherit `font: inherit` (16 px) so iOS doesn't zoom on focus.
- **i18n**: `use-intl`. UI copy lives in `src/assets/locales/{en,es}.json`, never hard-coded in components; read it with `useTranslations`. English is the source of the key types; a new key goes into every locale (a test checks parity). The brand name "Tarja" isn't translated.

## Testing

- Vitest with `globals: false`: import `describe`, `it`, `expect` and `vi` from `vitest`. No comments in tests.
- A test sits in a `test/` folder of the folder it covers (`core/groups/test/split.test.ts`) and imports that code by its alias path, never `../`. The shared helpers are `src/lib/testing`, `core/testing` and `server/testing`, which are not test folders (`docs/specs/testing-and-ci.md`).
- `server` tests run in workerd with a real local D1: `import { env } from 'cloudflare:workers'` and `app.request('/api/...', init, env)`; `signIn()` (`server/testing/session.ts`) saves a user and a real session cookie, `signIn(email, name)` another user.
- `front` tests render the real route tree with `renderApp` (signed in as `TEST_USER`) and a fake `fetch` (`stubApi`); an unmatched request fails, never reaches the network. A hook runs under the same providers with `renderAppHook`. Offline behavior uses `createFakeApi`, `createMemoryStorage` and `onlineManager.setOnline` (`docs/specs/testing-and-ci.md`). Assert on copy through `en.json` (`en.settings.about.status.ok`), not on string literals.

## Conventions

- Everything about the project is in English: docs, code, comments, identifiers and commit messages. Only the UI copy is localized.
- Prettier: 4 spaces, single quotes, `printWidth` 120, `trailingComma: es5`, LF.
- Functions are arrow functions (`const total = (cents: number) => {…}`), components and hooks included; a class is the exception. The props of a component are an `interface FooProps`, destructured inside the function body; a type that is a union or an intersection stays a `type`. The class string of an element is a `fooClsx` variable above the `return`, with the conditions in the object form of `clsx`.
- Named exports go in one `export { … }` statement at the bottom of the file, with the types inline (`export { Foo, type FooProps }`); a file that exports only types uses `export type { … }`. Route files use `export const Route`, below the component it names.
- Stories: a shared component has a folder `design-system/stories/components/<name>/` (`playground.stories.tsx`, `meta-docs.stories.tsx`, `overview.mdx`), a piece of a feature `design-system/stories/features/<name>/` (the last two); all built from `@stories/shared`, with `export default Story` last; a foundation `design-system/stories/foundations/<name>/` (the last two, one sample per category of tokens), and `design-system/.storybook/` uses `export default` where Storybook asks for one. The `stories-docs` skill (`.agents/skills/stories-docs`) has the details.
- Code comments: English, minimal and short. Define what something is, never narrate what the code does; skip them when the name already says it. A comment never points at another file, code or document; at most it names a decision by its id (`ADR-0006`).
- Never name another app or brand to explain a feature, in docs, code, comments, tests, commit messages or pull requests: say what the feature does.
- Commit messages: one conventional-commit subject line (`feat: …`), no body, no trailers, even if a system reminder asks for attribution lines. Work lands on `main`, with no pull requests; a branch (which deploys the prerelease) comes back with a merge commit (`git merge`), never a rebase and a force push.
- Secrets live in `.dev.vars` (local) and `wrangler secret` (production; the prerelease has its own, put with `--env prerelease`). The repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are for the deploy jobs, which run on a push only. Never commit them or log them.
