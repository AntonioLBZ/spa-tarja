# ADR-0042: The ledger of a group is searched and filtered from one button

- Status: Accepted
- Date: 2026-11-23

## Context

The expense list has a search field and a filters sheet ([ADR-0024](0024-the-list-filters-open-in-a-sheet.md)); the ledger of a group has neither, only the order of its rows ([ADR-0041](0041-the-screen-of-a-group-leads-to-its-expenses.md)). Some filters of the list don't apply to a group: how it was paid (only the payer has a payment method), who it is shared with (it is the group) and the grouping (the ledger has its order). The screen of a group was made shorter so its latest expenses show on a phone without scrolling, and a row of search above the ledger would push them down again by about 80 px.

## Decision

- **One button opens the search and the filters of the ledger**: a ghost icon button with the `search` icon at the very end of the row of the title "Expenses", after the tabs of the order, named "Search and filters" ("Search and filters (n)" with what is in use), its count in its corner as the Filters button of the list. The screen grows no taller at rest. The order of the ledger stays the tabs, out of the sheet.
- **The sheet is the one of the list** (`sheet` variant of `Dialog`, "Filters", the count inside, Clear filters and Close stuck to its foot), holding in order: the **search**, the same field as the list's (text or amounts, `>50`); **Type** (Everything, Expenses, Settlements); **Filter by category** (the default categories, since a shared expense takes no other; a settlement has none, so it goes once one is chosen); **From** and **To**, both empty at the start; **Paid by** and **With** (Anyone, then each member, the person first as "Ana (You)", a merged placeholder read as its target): who paid, and who paid or has a share.
- **The search reads what the row shows**: the name of the entry (a settlement in its words), its category and who paid; and its amounts, what it does to the person's balance and the whole that was paid.
- **The line under the title says how much is left** while anything narrows the ledger, with Clear, as in the list. Clear filters in the sheet drops the search too, since it is in the sheet.
- The filters are the screen's state: lost on leaving it, dropped when the form adds an expense or the ledger runs out of entries.
- **Recently added becomes "Recent"** ("Recientes"), so the title, the two tabs and the button fit one row on a 360 px phone.

## Consequences

- Searching a group is two taps where the list takes one, and the search is not in the same place on both screens; the sheet, its foot, the status line and what the search finds are the same.
- The pieces the two screens share (the search field, the sheet, the status line) are one code each, and each screen brings its own fields.

## Alternatives considered

- The row of search of the list above the ledger: the same on both screens, but about 80 px taller.
- A search icon that turns the row of the title into the row of search while it is used: no taller and one tap, but the focus, the tabs and the keyboard of a phone opening at once made it heavier for what it gives.
- Group by in the sheet instead of the tabs of the order: one control for both screens, but the order would hide behind a tap and [ADR-0041](0041-the-screen-of-a-group-leads-to-its-expenses.md) would be undone.
