# Repository structure

```
server/          Worker (Hono): app.ts (routes and AppType), index.ts (entry)
src/             SPA: routes/ (file-based), features/, components/, lib/, assets/ (styles, locales)
db/              D1 SQL migrations (db/migrations)
core/            pure logic shared by client and server
design-system/   Storybook and the stories of the components (a pnpm workspace package)
public/          static files
```

- `server/` doesn't import from `src/`. `src/` only imports **types** from `@server/*`.
- `design-system/` imports from `src/` and `core/` (as `@/*` and `@core/*`); nothing imports from it. A `packages` entry in `pnpm-workspace.yaml` makes it a workspace member and the root script `storybook` delegates to it. It has its own Vite config and `tsconfig.json` (the `@/*` and `@core/*` paths point up into `src/` and `core/`), without the Cloudflare, router and PWA plugins of the app. `.storybook/` holds the config and the preview. `stories/foundations/` shows the tokens, read from `tokens.css` itself so a new token appears on its own (colors, the category colors, the accents, spacing, type, motion and the icon set), and `stories/components/` has one file per shared component. A component that keeps no state of its own gets a story with controls; one that needs a state, a router or a provider is shown through a small demo inside the story file. The preview imports `main.css`, wraps every story in the real `LocaleProvider`, `ThemeProvider` and `AccentProvider`, and the toolbar sets the theme, the accent, the language and the viewport (320, 390, 640 and 1024 px). The three choices are written to the same storage the app reads and the providers start again, so a story's own state is lost when one changes. `pnpm storybook` serves it on port 6006, with telemetry off; `storybook-static` is the build output and stays out of git, Prettier and ESLint.
- `core/` imports nothing from React, Hono or Workers (ESLint enforces it). The category classifier, the money helpers, what counts in a month and the list and chart logic live there. Both sides import it as `@core/*`; the server also reaches its own subfolders as `@server/*`, so `../` is never needed.
- `wrangler.jsonc` sets `run_worker_first: ["/api/*"]` and `not_found_handling: "single-page-application"`: any path that isn't `/api/*` or a file falls back to `index.html`, and an unknown `/api/…` answers 404 from the Worker.
- `worker-configuration.d.ts` (runtime and binding types) is generated with `pnpm types:gen` and committed. Regenerate it after editing `wrangler.jsonc`.
- **Production** is `https://tarja.antoniolbz.workers.dev` (account subdomain `antoniolbz`, free). The D1 database `tarja` is bound as `DB` with its `database_id` committed in `wrangler.jsonc` (an id, not a secret). A release goes out on its own: every push to `main` that passes the checks is deployed by GitHub Actions ([testing and CI](testing-and-ci.md)), after applying the migrations if `db/migrations` changed. By hand it is `pnpm db:migrate:remote`, then `pnpm deploy:prod`. The migrations go first so the new code never meets an old schema, which means each one must work with the code still running: add, never rename or drop. Secrets go up with `wrangler secret put`.

## Dependencies

- pnpm only, with `save-exact` in `.npmrc`: dependencies are added with `pnpm add -E`. The versions are in `package.json`.
- Install scripts are allowed only for `workerd` and `esbuild`, in `pnpm-workspace.yaml`. pnpm 12 also offers "agent skills" shipped by some packages; the two that offer them, `@tanstack/react-router` and `@tanstack/router-plugin`, are denied: they only feed AI assistants and the build doesn't need them.
- `design-system/` pins the same `react`, `react-dom` and `vite` as the root, so pnpm keeps one copy of React. Storybook 10 (`storybook`, `@storybook/react-vite`, `@storybook/addon-a11y`) needed no install script and offered no agent skills.
- Held back, as of 2026-10-25: TypeScript stays on 6.0, because 7.0 exists but `typescript-eslint` 8.72 requires `<6.1`. ESLint stays on 9, because `eslint-plugin-import` doesn't support ESLint 10.
- Tests use `@cloudflare/vitest-plugin`, which replaces the deprecated `@cloudflare/vitest-pool-workers`. `vite-plugin-pwa` goes with `workbox-build` and `workbox-window` at the same version, and the icons come from `@vite-pwa/assets-generator`.
