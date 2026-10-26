# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the installed PWA on a real phone: install prompt and the update prompt. Desktop Chromium already loads the shell offline, Android OK.
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install), and the visual identity there: the Dot Matrix logo in the header, the amber accent (one of those the user can pick) next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Guest mode (item 8) overturns a recorded decision ("Google login only"): say whether to build it.
- Charts: may a category color fill that category's mark in a chart (the split strip)? It needs a `design.md` §2 change. Built without it, in the accent, until you answer.

## 8. Guest mode (L, blocked until the owner decides)

No account, fully offline, local data only. Later the person signs in and the app offers to move the guest expenses.

1. Phase 1 (M): auth state `guest` and a `tarja:guest` flag; `OwnerProvider` and `useOwner()` replace `UserProvider` (`useUser()` stays for account-only screens); the guest's store is `tarja:outbox:guest`, never pushed; a `localExpensesQuery` that never imports `@/lib/api`. Categories, income and the health line are off for a guest with the reason shown. Settings gets a guest card ("your data lives only on this device", Sign in, Delete) and the sign-in screen "Continue without an account". `navigator.storage.persist()` on entry, plus a warning about eviction (iOS Safari clears after 7 days unopened if not installed).
2. Phase 2 (M): `lib/offline/guest-transfer.ts` with `moveGuestExpenses`: write a marker, `putAll` into the account's outbox (ids and `updatedAt` untouched), delete the guest data only after the server confirmed every id; re-running is idempotent. A banner, not a modal: "Move N expenses to <email>?" with Move and Not now (asks again next open). An account that already has data gets them added beside its own. After a move, a second account is never offered them.
3. Test that matters: through every route, save, delete and an online/offline toggle, the fake API sees only `GET /api/auth/get-session`.
4. Docs to change: `ARCHITECTURE.md` §2 (login, "no SEO"), §6, §8, §11; `AGENTS.md` (Google login only, the per-user storage line, `AuthGate`, Testing); `design.md` §5 (Summary and Categories offline lines, a Sign-in and guest section). Locale keys `auth.guest*`, `settings.guest.*`, `guestTransfer.*`, `categoryManager.guest`, `summary.guest`.
5. Risks: guest data can be lost to eviction (warn, can't fix); moving to the wrong account can't be undone (the email in the prompt is the safeguard).
6. Recommendation: build both phases only if strangers should be able to try Tarja. Skip guest custom categories and income.

## 9. Dark mode pass (M, last)

- Done on paper: no raw colors outside `tokens.css`; every text and accent pair passes in dark.
- `--color-border-subtle` dark (`#2e2e2e`) is 1.55:1 on black and 1.36:1 on `#141414`, below the 3:1 `design.md` §2 claims. It draws the disabled notch, the quiet message notch (`expense-list.css`) and the delete notch. Either raise it to about `#767676` or correct the claim and keep it a hairline; and §3 says messages use ink while the code uses subtle in four places.
- The primary button's ink notch on the accent fill is 1.5 to 2.4:1 in dark. `vite.config.ts` manifest colors are light only.
- Eye pass in Chrome at phone width, light and dark, the six accents: every screen and state, including what items 2 to 8 added (cards, header underline, filters, chart, guest notices, autofill, the date input icon).
