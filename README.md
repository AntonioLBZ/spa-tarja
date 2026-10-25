# Tarja

An installable web app to log everyday expenses: food, groceries, leisure, bills and rent. Each expense is categorized from its text, and the category can be changed. Built to work offline too.

A _tarja_ is the notched stick that was used to keep accounts.

## Stack

Vite, React 19 and TanStack Router/Query on the client. A Cloudflare Worker with Hono serves the API and the static assets, with D1 as the database.

## Development

Requires Node and pnpm.

```bash
pnpm install
pnpm dev          # http://localhost:5173, with a local D1
pnpm test
pnpm build
```

Design decisions are in [ARCHITECTURE.md](ARCHITECTURE.md).
