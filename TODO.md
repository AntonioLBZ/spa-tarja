# TODO

- Check the installed PWA on a real phone: install prompt and the update prompt. Desktop Chromium already loads the shell offline.
- D1 schema and first migration (`db/migrations`), in hand-written SQL.
- Expenses: idempotent `PUT /expenses/:id`, list and soft delete. A screen to log an expense.
- Default categories and the keyword classifier in `core/`.
- Offline queue in IndexedDB and sync.
- Google login (Better Auth on Hono) and per-user data. Add the `nodejs_compat` flag.
- Custom categories CRUD.
- Settings screen with a language switcher (the locale is already stored, see `useLocale`).
- Theme setting (system, light, dark): persisted choice, `data-theme` on `<html>`, `withColorTransition` as in `spa-anicalendar`, and the `theme-color` meta kept in sync (see `design.md` §2).
- Visual identity: settle the open questions in `design.md` §8 (uneven borders, accent hue, typeface, category identification without color, icons, route transitions).
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install).
- CI (GitHub Actions) and a pre-commit hook.
- First Cloudflare deployment: D1 `database_id`, domain.
