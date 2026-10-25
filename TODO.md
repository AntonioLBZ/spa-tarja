# TODO

- Installable PWA: manifest, icons (192/512 PNG and maskable, from `public/favicon.svg`), service worker with `vite-plugin-pwa`, offline shell.
- D1 schema and first migration (`db/migrations`). Decide Drizzle or hand-written SQL.
- Expenses: idempotent `PUT /expenses/:id`, list and soft delete. A screen to log an expense.
- Default categories and the keyword classifier in `core/`.
- Offline queue in IndexedDB and sync.
- Google login (Better Auth on Hono) and per-user data. Add the `nodejs_compat` flag.
- Custom categories CRUD.
- Settings screen with a language switcher (the locale is already stored, see `useLocale`).
- Visual identity: replace the placeholder palette in `tokens.css` and define the uneven borders.
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install).
- CI (GitHub Actions) and a pre-commit hook.
- First Cloudflare deployment: D1 `database_id`, domain.
