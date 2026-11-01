# Tarja

An installable web app to log everyday expenses: food, groceries, leisure, bills and rent. Each expense gets a category suggested from its text, and you can change it. It also works offline. Expenses can be shared with other people in groups, with a running balance of who owes whom (in the works on the branch `feat/shared-expenses`).

A _tarja_ is the notched stick that was used to keep accounts.

## Stack

Vite, React 19 and TanStack Router/Query on the client. A Cloudflare Worker with Hono serves the API and the static assets, with D1 as the database.

## Development

Requires Node and pnpm.

```bash
pnpm install
pnpm db:migrate   # the local D1: once, and again after pulling new migrations
pnpm dev          # http://localhost:5173, with a local D1
pnpm storybook    # the design system, http://localhost:6006
pnpm test
pnpm build
```

## Deployment

Every push to `main` runs the checks in GitHub Actions. If they pass, the new migrations are applied to the production D1 and the app is deployed to Cloudflare.

Decisions are in [docs/adr](docs/adr), how each part behaves in [docs/specs](docs/specs) and the visual rules in [design-system/DESIGN.md](design-system/DESIGN.md).
