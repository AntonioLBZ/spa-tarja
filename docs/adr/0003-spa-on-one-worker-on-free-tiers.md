# ADR-0003: A single-page app on one Cloudflare Worker, on free tiers

- Status: Accepted
- Date: 2026-10-25

## Context

Everything sits behind a login, so there is no SEO to serve. Categorization runs on the client and the app must work offline. Cloudflare has put Pages in maintenance and focuses its investment on Workers.

Cloudflare limits as of 2026-10-25 (official docs): D1 free gives 5 M rows read and 100 k rows written per day and 500 MB per database; Workers give 100 k requests per day.

## Decision

- A single-page app, not server-side rendering: a server-side first render would add nothing.
- One Cloudflare Worker serves the static assets and the API (`/api/*`) from the same origin. The session lives in an `httpOnly` cookie, with no CORS and no tokens in the browser.
- Workers with static assets, not Pages. The free URL is `tarja.<subdomain>.workers.dev`, and production is `https://tarja.antoniolbz.workers.dev`.
- Vite and React on the client, with TanStack Router (file-based, through the Vite plugin) and TanStack Query. Hono is only the API layer, and the client uses `hc<AppType>` to get the route types without a framework. D1 is the database.
- Free tiers only. If something needs payment, it is dropped.

## Consequences

- `wrangler.jsonc` sends only `/api/*` to the Worker first, and any other path that isn't a file falls back to `index.html`. See [repository structure](../specs/repository-structure.md).
- D1 counts every row a query scans as a read, so queries must be indexed by user and date: `(user_id, date)` and `(user_id, seq)`. See [data model](../specs/data-model.md).
- A custom domain needs its nameservers on Cloudflare and would mean updating the Google redirect URIs ([ADR-0008](0008-google-login-with-better-auth.md)). `tarja.dev` is available but costs money, which clashes with free tiers only; the domain is an open question in `TODO.md`.

## Alternatives considered

- **Next.js 16**: SSR and RSC would go unused and, on Workers, it needs the OpenNext adapter.
- **React Router 7 in framework mode**: its `loader` and `action` assume the network on every navigation, while here reads always come from local storage ([ADR-0005](0005-offline-first-with-an-outbox.md)).
- **Cloudflare Pages**: in maintenance.
