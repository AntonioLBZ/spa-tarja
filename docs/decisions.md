# Decisions

Holding file for the decisions of the project, until each one has an ADR of its own in `adr/` (`TODO.md` 19). How things behave is in [`specs/`](specs/); the visual rules are in [`DESIGN.md`](../design-system/DESIGN.md). The versions of the dependencies are in `package.json`.

## What it is and scope

An installable web app (PWA) to log everyday expenses: food, groceries, leisure, bills, rent. Each expense gets a category that is suggested from the text the user types and can be changed. Expenses can be logged offline.

Name: a _tarja_ is the notched stick that was used to keep accounts. The repo is `spa-tarja`, like the owner's other SPAs.

Out of scope for now: importing a backup, shared expenses, multiple currencies.

## Closed decisions

- **Everything about the project is in English**: docs, code, comments, identifiers and commit messages. Only the UI copy is localized ([frontend](specs/frontend.md)).
- **Solo project, work on `main`.** There is one developer, so no feature branches and no pull requests; commits go straight to `main`.
- **SPA, not SSR.** Everything sits behind a login (no SEO), categorization runs on the client and the app must work offline. Server-side first render would add nothing.
- **A single Cloudflare Worker** serves the static assets and the API (`/api/*`) from the same origin. The session lives in an `httpOnly` cookie, with no CORS and no tokens in the browser.
- **Workers with assets, not Pages.** Cloudflare has put Pages in maintenance and focuses its investment on Workers. The free URL is therefore `tarja.<subdomain>.workers.dev`, not `pages.dev`. A custom domain needs its nameservers on Cloudflare.
- **Vite + React + Hono + D1.** Hono is only the API layer; the client uses `hc<AppType>` to get the route types without a framework. A framework's `loader`/`action` assume the network on every navigation, while here reads always come from local storage.
- **Mobile-first.** The app is used on the go, so base styles target phones and widen with `min-width` queries ([frontend](specs/frontend.md)).
- **Progressive offline-first** ([offline sync](specs/offline-sync.md)): online first, the offline queue arrives in its own phase.
- **Google login**, no own passwords ([authentication](specs/authentication.md)).
- **Default categories** can't be edited or deleted for now. Custom ones can be created, edited and deleted.
- **Free tiers only.** If something needs payment, it is dropped. Cloudflare limits as of 2026-10-25 (official docs): D1 free gives 5 M rows read and 100 k rows written per day and 500 MB per database; Workers give 100 k requests per day. D1 counts every row a query scans as a read, so queries must be indexed by user and date.
- **Plain CSS** (variables and native nesting), no SCSS and no Tailwind. Reversible if needed.
- **Style**: flat colors with themes (system, light, dark), a white or black base, an accent picked from a fixed list, a color and an icon for every category, IBM Plex Mono, no rounded corners, the notch border (thick on the left and the bottom) and animated transitions. All visual rules, and what is still open, are in [`DESIGN.md`](../design-system/DESIGN.md).
- **The design system is shown in Storybook, in a workspace folder of its own** (`design-system/`, `TODO.md` 16). It is a private pnpm package that holds Storybook and the stories; the components stay in `src/components` and the stories import them, so `src/` carries no Storybook file, story or dependency. It runs on the owner's machine only (`pnpm storybook`): it is not published and not part of the deployed Worker, whose service worker would precache it.

## Pinned and held back

- **pnpm**: `save-exact` in `.npmrc`; `pnpm add -E`.
- **TypeScript**: 7.0 exists, but `typescript-eslint` 8.72 requires `<6.1`.
- **TanStack Router**: file-based, through the Vite plugin.
- **use-intl**: the same i18n setup as `spa-hoardex`.
- **Wrangler and `@cloudflare/vite-plugin`**: `vite dev` runs the Worker in `workerd` with a local D1.
- **vite-plugin-pwa**: with `workbox-build` and `workbox-window` 7.4.1; icons by `@vite-pwa/assets-generator` 2.0.0.
- **Vitest and `@cloudflare/vitest-plugin`**: the plugin used to be `@cloudflare/vitest-pool-workers` (now deprecated).
- **ESLint** 9.39.5: `eslint-plugin-import` doesn't support ESLint 10.

For the visual identity ([`DESIGN.md`](../design-system/DESIGN.md)): `@fontsource/ibm-plex-mono` 5.3.0 (OFL 1.1, self-hosted and precached). The Sharp SVGs of Material Symbols (Apache 2.0, from `@material-symbols/svg-400` 0.48.1) are copied into `src/components/icon` with their notice, not kept as a dependency, and a subset of Dot Matrix with the letters of the logo sits in `src/assets/fonts`.

Install scripts allowed in `pnpm-workspace.yaml`: `workerd` and `esbuild`. pnpm 12 also offers "agent skills" shipped by some packages; the two that offer them (`@tanstack/react-router` and `@tanstack/router-plugin`) are denied in `pnpm-workspace.yaml`, since they only feed AI assistants and the build doesn't need them.

For the design system (`design-system/`): Storybook 10 with `@storybook/react-vite` and `@storybook/addon-a11y` (10.6.5 on 2026-10-29, which accepts Vite 8 and React 19). No test addon: `@storybook/addon-vitest` needs Playwright browsers and overlaps the `front` tests.

## Discarded and open decisions

Discarded:

- **Next.js 16**: SSR and RSC would go unused and, on Workers, it needs the OpenNext adapter.
- **React Router 7 in framework mode**: its `loader`/`action` assume the network.
- **Cloudflare Pages**: in maintenance.
- **Cuadra, Menudo, Tally, Slate, Tab** as a name: taken on `.app`, `.dev` and `.com`.
- **Guest mode** (use the app with no account, local data only, moved to the account on sign-in), discarded by the owner on 2026-10-29: it overturns "Google login only", every future feature would need a guest behaviour, and guest data can be lost with the browser's storage. Revisit only if strangers should be able to try the app.
- **PWA shortcuts** on the installed icon, discarded by the owner on 2026-10-29: the icon already opens on the add form.
- **Recurring expenses**, not needed for now according to the owner (2026-10-29): duplicating an expense covers it.
- **A package for the components** (`packages/ui`) with Storybook inside, discarded for now (owner, 2026-10-29): `MonthSwitch` and `UpdatePrompt` read the messages, `ButtonLink` is typed against the app's routes, `Toast` and `DateRangeFields` import from `lib` and `core`, the tokens and the fonts live in `src/assets`, and 24 files import `@/components`. With one consumer and nothing to publish it buys nothing the workspace folder doesn't. Revisit with a second consumer.
- **Stories next to each component**, discarded for the same reason: `src/` would carry Storybook's files, its dependencies and a lint exception for `export default`.

Open:

- Whether CI builds Storybook or `types:check` and `lint` are enough. If it is ever published, it goes in a Worker of its own, never in the `dist` of the app (see Closed decisions).
- Locales beyond `en` and `es` (`spa-anicalendar` also ships `fr` and `de`).
- Domain: `tarja.dev` is available (2026-10-25) but costs money, which clashes with "free tiers only"; `tarja.app` and `tarja.com` are taken. `workers.dev` is in use; a custom domain would mean updating the Google redirect URIs.
