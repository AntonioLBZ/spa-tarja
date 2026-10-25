# TODO

Items build on each other in the order of their numbers. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the installed PWA on a real phone: install prompt and the update prompt. Desktop Chromium already loads the shell offline, Android OK.
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install), and the visual identity there: the Dot Matrix logo in the header, the amber accent (one of those the user can pick) next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Guest mode (item 8) overturns a recorded decision ("Google login only"): say whether to build it.
- Charts (item 7): may a category color fill that category's mark in a chart? It needs a `design.md` §2 change. Built without it until you answer.

## 3. Expense cards (M, after 2)

- Expense rows become disclosure cards like the category rows: the whole row toggles (badge, name, amount, details, chevron) and the panel under it holds Edit and Delete. One row open at a time is not enforced.
- Chevron `expand_more`, a half turn when open, on expense rows and on the owner's own category rows (built-in rows open nothing). A pencil only promises Edit, which is one of two actions in the panel.
- `expense-row.tsx`: the notch moves from the `li` to the toggle; `--leaving` stays on the `li`.
- Tests: open the row before each delete in `expenses.test.tsx`; chevron on own rows only in `category-manager.test.tsx`.
- Docs: `design.md` §4 (interface icons), §5 (an Expenses section, Categories), §6.

## 4. Header and collapsible add form (M, after 3)

- Header: `Expenses` link on the left, logo centered, `Summary` and `Settings` on the right (`grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr)`), links at `--font-size-s`. New key `nav.expenses` ("Expenses" / "Gastos").
- Underline: one element with `view-transition-name: nav-underline` inside the active link, so it slides between words. `navSection()` in `route-transition.ts` maps `/charts` to Summary and `/categories` to Settings; a move inside a section fades (`level` type). Read the route with `useRouterState({ select })` on `resolvedLocation`, or the slide is lost. The logo is never underlined.
- Add form: `AddFormProvider` and `useAddForm()` (`{ open, setOpen }`, in memory, open by default) in `RootLayout`. `Expenses` calls `setOpen(false)`, the logo `setOpen(true)`, both skipped on modified or non-primary clicks. Context, not a search param: pressing a link whose URL doesn't change doesn't navigate.
- `AddExpense`: `<h2><button aria-expanded aria-controls>` over an always-mounted form in a `hidden` div, so the draft survives; fade and shift with `@starting-style`, chevron rotates.
- Mobile: the logo is 57.6 px wide and exact centring needs about 362 px; below that it drifts up to 21 px. Verify in Chrome at 320, 360 and 390 px, en and es (`scrollWidth <= clientWidth`, logo centre against `innerWidth / 2`).
- Tests: `routes.test.tsx` (open by default, Expenses collapses, logo opens, draft survives, `/charts` underlines Summary), `route-transition.test.ts`.
- Docs: `design.md` §5 (header zones, widths), §6 (underline, `level`, disclosure).

## 5. Edit an expense (L, after 3 and 4)

- Edit in the card panel loads the expense into the add form: `editing: Expense[] | null` in `Home`, `<ExpenseForm key={editing?.[0].id ?? 'new'}>` so a remount returns to "add". It opens the form with `setOpen(true)`, scrolls to it (instant under reduced motion) and focuses its heading. New copy: title, Save, Cancel (en + es). Save or Cancel focuses the edited row.
- `draftOf(parts)` and `reviseExpenses(original, draft)` in `create-expenses.ts`: keep ids by part number and `createdAt`, new parts get new ids under the same plan, removed parts are saved with `deletedAt`, and `updatedAt = max(now, newest + 1)`. No API or migration change: `PUT /expenses/:id` already upserts.
- The saved category stays (no suggestion overwrite; an unknown id shows Other). Edit is off for a plan with parts missing on this device. Deleting the expense under edit ends the edit; so does pressing Expenses or the logo on `/`.
- Defaults to confirm: editing a plan edits the whole plan, charged parts included; Edit replaces an unsaved new draft without asking; Delete keeps no confirmation.
- `ARCHITECTURE.md` §5: a plan edited on two devices can end up mixed, and an edit after a delete elsewhere brings the expense back.
- Tests: new `create-expenses.test.ts`; an "editing an expense" block (same id and `createdAt`, plan with fewer or more parts, card payment, offline gives one write, cancel, focus).

## 6. Search, filters and grouping of the list (M, after 2 and 3)

- `core/text.ts` (move `normalizeText` out of the classifier) and `core/expense-list.ts`: `buildList(expenses, filters, grouping, ctx)` collapses plans first, filters on the row shown, groups by day, week, month or category and returns `{ key, items, totalCents }`. Replaces `groupByDay`.
- Filters: text (every word, ignoring case and accents, over the text and the category label), category (unknown ids count as Other), from/to on the day made, and paid with (any, now, credit card, restaurant card, installments). They live in `useState` and reset on leaving, so a stale filter never hides a new expense. The grouping is remembered in `tarja:list-grouping`.
- UI: search field, "Filters (n)" toggle with a panel (group by, "Filter by category", dates, paid with), "Showing x of y" with Clear, a no-match state, `DateRangeFields` extracted from the charts, 100 rows with "Show more" instead of virtualisation.
- Group header: label plus subtotal of the rows listed, by day made, a plan at full price on its purchase day, so it can differ from Summary's "spent". Week groups read "Week of …"; category groups use the badge. Edit gets the original expense, not the filtered copy.
- Tests: core (accents, a plan stays one row, weeks start on Monday, subtotals, unknown category) and an `expenses.test.tsx` block. Docs: `design.md` §5 "Expense list controls", `ARCHITECTURE.md` §5 (the list is by day made, not spending).

## 7. Charts rework (L, after 2 and 6)

- No dependency: hand-rolled SVG is about 4 KB, against 20 to 150 KB gzipped for libraries that can't read the CSS tokens.
- `core/charts.ts`: `niceScale(maxCents)` and `previousRange(granularity, range)`.
- `spending-chart.tsx`: square columns in `--color-bg-accent` on a `viewBox`, hairline grid, HTML tick labels, the biggest column and today's bucket marked. Tap, or arrows with Home and End on one tab stop, fill a readout line (`aria-live`). `role="img"` with a generated summary, and a collapsed "Show the numbers" `<details>` table as the text alternative.
- A stat row with the total and the change against the previous period (signed %, ↑/↓, never color alone).
- `category-split.tsx`: one stacked strip above the ranked rows, in the accent with gaps until the owner allows category colors on marks. Columns animate `scaleY`, segments `scaleX`, over `--duration-base`. Delete `components/bar`.
- New keys (en + es): `readout`, `chartSummary`, `vsPrevious`, `noPrevious`, `showNumbers`. `charts.test.tsx` reads the table instead of the bars; new tests for the keyboard readout, the summary and the previous period.
- Docs: rewrite `design.md` §5 Charts; `ARCHITECTURE.md` §5. Risks: 400 columns on 320 px read as a silhouette; amber next to the orange and yellow fills.

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
