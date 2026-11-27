# Tarja

An installable web app to log everyday expenses: food, groceries, leisure, bills and rent. Each expense gets a category suggested from its text, and you can change it. It also works offline. Expenses can be shared with other people in groups, with a running balance of who owes whom.

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

GitHub Actions deploys a push to `main` that passes the checks and carries a new version (a `version` in `package.json` with no GitHub Release yet), applying the new migrations to the production D1 first; any other push to `main` only runs the checks. A push to any other branch deploys a prerelease at `tarja-prerelease.albz.app`, with its own database. Each release also publishes the design system at [tarja-storybook.albz.app](https://tarja-storybook.albz.app).

Decisions are in [docs/adr](docs/adr), how each part behaves in [docs/specs](docs/specs) and the visual rules in [design-system/DESIGN.md](design-system/DESIGN.md). Each ADR and spec opens with a front matter that says what it covers ([docs/README.md](docs/README.md)).
