# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the installed PWA on a real phone: install prompt and the update prompt, the real toolbar color and, on Android, the splash (the manifest stays light because light is the default; an app set to dark opens on a light splash). Desktop Chromium already loads the shell offline, Android OK.
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install), and the visual identity there: the Dot Matrix logo in the header, the amber accent (one of those the user can pick) next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Guest mode (item 8) overturns a recorded decision ("Google login only"): say whether to build it.
- Charts: may a category color fill that category's mark in a chart (the split strip)? It needs a `design.md` §2 change. Built without it, in the accent, until you answer.
- Dark mode, the hairline `--color-border-subtle` (`#d4d4d4` light, `#2e2e2e` dark) is 1.4 to 1.6:1 in both themes, while `design.md` §2 claims 3:1 and §3 Shape says quiet messages use ink (the code uses the hairline). It draws disabled notches, quiet notices, the Delete notch, the chart grid and the numbers table rules. Option A: raise it (`#767676` gives 4:1 or more, but the grid and table compete with the data; or a second token for the three box edges only). Option B (recommended): correct the document, the hairline is decorative and text already identifies each box.
- Dark mode, the ink notch on an accent fill (primary button, checked option of a choice group, pressed toggle) is 1.5 to 2.4:1 in dark and 2.0 to 4.2:1 in light. Option A: retune the twelve accent tones so it reaches 3:1 (dark accents turn from pastel to mid-tones). Option B (recommended): correct the document, the fill (4.5:1 or more against the page) is what marks the control. The selected chart column is weak in dark gray either way; say if it should get an ink frame instead.
- Chrome draws the search field's clear button as a blue × in light. Hide it (the Clear button and the keyboard still work) or draw our own × in the text color?
- Offline, the income and new-category fields still look enabled while their buttons are disabled; disable the fields too?
- Editing and deleting, defaults I picked (`ARCHITECTURE.md` §5): editing a plan edits the whole plan, charged parts included; Edit replaces a new expense half typed in the form without asking; Delete has no confirmation. Adding an expense clears the list's search and filters (not the grouping), so the new row is never hidden. Change any of them?
- The change against the previous period compares spans of the same length, and says "so far" while the range is still running. Is that what you expect?

## 8. Guest mode (L, blocked until the owner decides)

No account, fully offline, local data only. Later the person signs in and the app offers to move the guest expenses.

1. Phase 1 (M): auth state `guest` and a `tarja:guest` flag; `OwnerProvider` and `useOwner()` replace `UserProvider` (`useUser()` stays for account-only screens); the guest's store is `tarja:outbox:guest`, never pushed; a `localExpensesQuery` that never imports `@/lib/api`. Categories, income and the health line are off for a guest with the reason shown. Settings gets a guest card ("your data lives only on this device", Sign in, Delete) and the sign-in screen "Continue without an account". `navigator.storage.persist()` on entry, plus a warning about eviction (iOS Safari clears after 7 days unopened if not installed).
2. Phase 2 (M): `lib/offline/guest-transfer.ts` with `moveGuestExpenses`: write a marker, `putAll` into the account's outbox (ids and `updatedAt` untouched), delete the guest data only after the server confirmed every id; re-running is idempotent. A banner, not a modal: "Move N expenses to <email>?" with Move and Not now (asks again next open). An account that already has data gets them added beside its own. After a move, a second account is never offered them.
3. Test that matters: through every route, save, delete and an online/offline toggle, the fake API sees only `GET /api/auth/get-session`.
4. Docs to change: `ARCHITECTURE.md` §2 (login, "no SEO"), §6, §8, §11; `AGENTS.md` (Google login only, the per-user storage line, `AuthGate`, Testing); `design.md` §5 (Summary and Categories offline lines, a Sign-in and guest section). Locale keys `auth.guest*`, `settings.guest.*`, `guestTransfer.*`, `categoryManager.guest`, `summary.guest`.
5. Risks: guest data can be lost to eviction (warn, can't fix); moving to the wrong account can't be undone (the email in the prompt is the safeguard).
6. Recommendation: build both phases only if strangers should be able to try Tarja. Skip guest custom categories and income.
