# Tarja

An installable web app to log everyday expenses: food, groceries, leisure, bills and rent. Each expense gets a category suggested from its text, and you can change it. It also works offline.

A _tarja_ is the notched stick that was used to keep accounts.

## Stack

Vite, React 19 and TanStack Router/Query on the client. A Cloudflare Worker with Hono serves the API and the static assets, with D1 as the database.

## Development

Requires Node and pnpm.

```bash
pnpm install
pnpm db:migrate   # the local D1: once, and again after pulling new migrations
pnpm dev          # http://localhost:5173, with a local D1
pnpm test
pnpm build
```

## Deployment

Every push to `main` runs the checks in GitHub Actions. If they pass, the new migrations are applied to the production D1 and the app is deployed to Cloudflare.

Decisions are in [docs/decisions.md](docs/decisions.md), how each part behaves in [docs/specs](docs/specs) and the visual rules in [design-system/DESIGN.md](design-system/DESIGN.md).
