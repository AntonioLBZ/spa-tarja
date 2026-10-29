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
- `design-system/` imports from `src/` and `core/` (as `@/*` and `@core/*`); nothing imports from it. A `packages` entry in `pnpm-workspace.yaml` makes it a workspace member and the root script `storybook` delegates to it. It has its own Vite config, without the Cloudflare, router and PWA plugins of the app.
- `core/` imports nothing from React, Hono or Workers (ESLint enforces it). The category classifier, the money helpers, what counts in a month and the list and chart logic live there. Both sides import it as `@core/*`; the server also reaches its own subfolders as `@server/*`, so `../` is never needed.
- `wrangler.jsonc` sets `run_worker_first: ["/api/*"]` and `not_found_handling: "single-page-application"`: any path that isn't `/api/*` or a file falls back to `index.html`, and an unknown `/api/…` answers 404 from the Worker.
- `worker-configuration.d.ts` (runtime and binding types) is generated with `pnpm types:gen` and committed. Regenerate it after editing `wrangler.jsonc`.
- **Production** is `https://tarja.antoniolbz.workers.dev` (account subdomain `antoniolbz`, free). The D1 database `tarja` is bound as `DB` with its `database_id` committed in `wrangler.jsonc` (an id, not a secret). A release goes out on its own: every push to `main` that passes the checks is deployed by GitHub Actions ([testing and CI](testing-and-ci.md)), after applying the migrations if `db/migrations` changed. By hand it is `pnpm db:migrate:remote`, then `pnpm deploy:prod`. The migrations go first so the new code never meets an old schema, which means each one must work with the code still running: add, never rename or drop. Secrets go up with `wrangler secret put`.
