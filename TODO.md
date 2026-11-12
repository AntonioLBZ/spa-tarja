# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- After the first deploy, check the headers on the root, on a deep link and on the API, with GET, since the static headers file is not exercised by the tests: `for p in / /join/x /groups /favicon.svg /api/health; do curl -sS -o /dev/null -D - "https://<the app address>$p" | grep -iE 'content-security|x-frame|referrer-policy'; done`. All five must print all three headers (`frame-ancestors`, `X-Frame-Options` and `Referrer-Policy`). If the single-page fallback lacks them, `frame-ancestors` cannot be set by a `<meta>` tag: decide then.
- **Before the merge, in the dashboards and on production:**
    1. What one Workers Logs entry holds (the `cookie` header, the IP, `x-tarja-user`, the location): open one of `PUT /api/expenses/<id>` and one of `GET /api/auth/callback/google`. If the cookie shows, turn the invocation logs off (`"observability": { "enabled": true, "logs": { "invocation_logs": false } }`).
    2. That the IP reaches the session row in production, after signing in: `pnpm wrangler d1 execute tarja --remote --command "SELECT ipAddress, userAgent FROM session WHERE userId = '<id>' ORDER BY createdAt DESC LIMIT 1"`.
    3. The location and the jurisdiction of the D1 database (Dashboard, D1, tarja); the jurisdiction can only be set when a database is created.
    4. That no zone feature of the domain adds analytics, a tool loader or a bot cookie to `tarja.albz.app` (Web Analytics automatic setup, Zaraz, the bot mode that sets `__cf_bm`).
    5. That the `account` rows hold no tokens and `user.image` is empty right after migration `0013` has run in production, and still so after the next sign-in: `SELECT providerId, idToken IS NOT NULL AS id_token, accessToken IS NOT NULL AS access_token, refreshToken IS NOT NULL AS refresh_token FROM account WHERE userId = '<id>'` and `SELECT image FROM "user" WHERE id = '<id>'`.
    6. An account deletion from start to end in production with a second Google account: make a group with a dummy, add that account as a friend in the dummy's place, delete it, then look for its email and the old dummy name in `user`, `session`, `account`, `profile`, `expenses` and `shared_members`.
    7. The rows of the old fixed user (`docs/specs/authentication.md`) that nobody can reach: delete them if they hold nothing worth keeping.
    8. The Google consent screen (Google Cloud console): publishing status, app name and support email.
- On a real phone, on the prerelease: the list of a `Select` at the bottom of a sheet (Plazos, Pago) opens above the field or shows its options, with the keyboard of the other fields closed and open, and the active option stays in view ([`DESIGN.md`](design-system/DESIGN.md#select)). Only a phone tells how `visualViewport` behaves with the keyboard.
- Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **The same component, another variant.** Not answered yet: the row of actions copied in `category-row`, `expense-row`, `expense-form` and `dialog` (a component or leave it), and the titles and hints repeated in eight CSS files (`:where(h1)` and `:where(h2)` in `base.css`, or leave them).
- **Stories of the groups.** None yet for Settle up, the Leave and Delete panels, the steps of a person, `InvitationLink` or `InviteFriend`; the ledger row has one (`Features/LedgerRow`).
- **`:focus-visible` of the rest.** The ring of `ChoiceGroup`, `Select` and the `Dialog` is done. What is left is the global one, on buttons, links and fields: with the gray accent it sits next to the ink edge and may be hard to tell apart, which only the owner's eye can say. A throwaway story that forces the focus on each component, to look at every accent in light and dark, would settle it.

## 19. Selects whose menu does not fit

Review `Select` when its list of options does not fit in the space below it (a short phone, the keyboard open, the bottom of a sheet): where it opens, whether it flips upward or scrolls inside, and that the active option stays in view. Part of the phone checklist of the sheets (the list at the bottom of the bottom sheet), not yet looked at on a real device.
