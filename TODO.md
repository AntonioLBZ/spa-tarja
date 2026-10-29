# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the installed PWA on a real phone: install prompt and the update prompt, the real toolbar color and, on Android, the splash (the manifest stays light because light is the default; an app set to dark opens on a light splash). Desktop Chromium already loads the shell offline, Android OK.
- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install), and the visual identity there: the Dot Matrix logo in the header, the amber accent (one of those the user can pick) next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Charts: may a category color fill that category's mark in a chart (the split strip)? It needs a `design.md` §2 change. Built without it, in the accent, until you answer.
- Dark mode, the hairline `--color-border-subtle` (`#d4d4d4` light, `#2e2e2e` dark) is 1.4 to 1.6:1 in both themes, while `design.md` §2 claims 3:1 and §3 Shape says quiet messages use ink (the code uses the hairline). It draws disabled notches, quiet notices, the Delete notch, the chart grid and the numbers table rules. Option A: raise it (`#767676` gives 4:1 or more, but the grid and table compete with the data; or a second token for the three box edges only). Option B (recommended): correct the document, the hairline is decorative and text already identifies each box.
- Dark mode, the ink notch on an accent fill (primary button, checked option of a choice group, pressed toggle) is 1.5 to 2.4:1 in dark and 2.0 to 4.2:1 in light. Option A: retune the twelve accent tones so it reaches 3:1 (dark accents turn from pastel to mid-tones). Option B (recommended): correct the document, the fill (4.5:1 or more against the page) is what marks the control. The selected chart column is weak in dark gray either way; say if it should get an ink frame instead.
- Chrome draws the search field's clear button as a blue × in light. Hide it (the Clear button and the keyboard still work) or draw our own × in the text color?
- Offline, the income and new-category fields still look enabled while their buttons are disabled; disable the fields too?
- Editing and deleting, defaults I picked (`ARCHITECTURE.md` §5): editing a plan edits the whole plan, charged parts included; Edit replaces a new expense half typed in the form without asking; Delete has no confirmation. Adding an expense clears the list's search and filters (not the grouping), so the new row is never hidden. Change any of them?
- The change against the previous period compares spans of the same length, and says "so far" while the range is still running. Is that what you expect?

## 11. Undo after delete (S)

Delete keeps no confirmation, so it gets an Undo.

1. A shared `Toast` (`src/components/toast/`): a flat box with the notch on the left, above the safe area, with a provider in the root layout next to `AddFormProvider` so it survives a change of screen. The `role="status"` region is always mounted; the message ("Deleted <name>") and an Undo button go inside it. It stays 8 s, paused while hovered or focused; Escape closes it; a new delete replaces it. It comes in and leaves with a fade and a short shift over `--duration-base`.
2. Undo writes every part again with `deletedAt: null` and `updatedAt = max(now, deletedAt + 1)` (the later-than rule of an edit), through the outbox, so it works offline and after the delete has synced. A plan comes back whole, and the row enters with the usual animation.
3. Focus stays on the neighbour row after Delete, as now; the toast is the last stop in the tab order.
4. Docs first: `design.md` §3 (Toast) and §6, `ARCHITECTURE.md` §5 (Delete: no confirmation, but Undo). Tests: undo, a plan, offline, expiry, replaced by the next delete, Spanish copy.

## 12. Duplicate an expense (S)

1. A Duplicate button in the row panel, next to Edit and Delete, with the rule of Edit (`canEdit`: not for a plan with parts missing on the device).
2. It opens the add form loaded with the expense (`draftOf`): text, category, amount, payment and your part. The date is today; a deferred payment takes the charge date the form proposes for that date; a plan keeps its installments and amounts. Owner decision: it opens the form, it does not copy in one tap.
3. Save writes a new expense with `createExpenses`: new ids and, for a plan, a new plan id; the currency is kept. Like Edit, it replaces an unsaved draft without asking. `AddFormProvider` gains `startCopy(parts)`; heading and focus as in Edit.
4. Docs first: `design.md` (the row panel), `ARCHITECTURE.md` §5.

## 13. Export (S to M)

Owner decision: export only, no import for now.

1. Settings gets a "Your data" section with two buttons, a JSON backup and a CSV for a spreadsheet. Both are built on the device from the local copy (the cache with the outbox on top), so they work offline and send nothing to the server. Deleted expenses are left out.
2. JSON: `{ app, version, exportedAt, expenses, categories, income }`, the stored fields as they are, custom categories only, a plan as one row per part.
3. CSV: one row per expense or plan part with date, text, category name, amount, currency, payment, charge date, your part and part ("2/3"). The delimiter and the decimal follow the app language (Spanish `;` and `12,50`, English `,` and `12.50`), UTF-8 with BOM. A text that starts with `=`, `+`, `-` or `@` gets a leading `'` so a spreadsheet never runs it as a formula.
4. Pure logic in `core/export.ts` with tests; the download in Settings; the file is `tarja-YYYY-MM-DD.json` or `.csv`.
5. Docs first: `ARCHITECTURE.md` §1 (export is no longer out of scope) and §5 (the formats), `design.md` §5 (Settings), locale keys in `en` and `es`.

## 14. Suggestions from your own history (S to M, client only)

Owner: "ideal". The design below still needs a yes before building.

1. The description field offers the user's earlier expenses that start with what is typed (`normalizeText`: no case, no accents). Picking one fills category and amount.
2. The suggested category looks at the history first: the category most used for the same normalized text, the latest on a tie; without a match, the keyword classifier as now. A category picked by hand is never replaced.
3. No new storage and no network: it reads the expenses already on the device.
4. To settle first: how many suggestions to show, whether the payment is filled too, and a native `datalist` against a custom listbox (styling and accessibility).

## 15. Budgets (L, architectural: spec before code)

Owner decisions: a monthly total and a limit per category, both; warnings inside the app only, no push.

1. Progress bars in Summary (the total and each category with a limit), a notice when an added expense brings a limit near or over it, and one when the leftover goes negative.
2. To settle in the spec: whether a limit holds for every month until changed or is set for a month; the thresholds (for example 80 % and 100 %); what counts toward it (`countedCents` by the day made, so a restaurant card counts your part; to confirm); the warning for a credit card whose charges pile up in a month (the open question of `ARCHITECTURE.md` §12); a category deleted while it has a limit; where limits are edited.
3. Storage like income, to confirm: a D1 table by an additive migration, `/api/budgets` behind `withUser`, cached for reading offline, editing needs a connection.
4. Docs: `ARCHITECTURE.md` §1 (budgets are no longer out of scope), §5, §8 if needed, `design.md` §5 (Summary).
5. Process: questions, approaches, a written spec and a plan before any code.
