# ADR-0024: The list filters open in a sheet

- Status: Accepted
- Date: 2026-11-13

## Context

The filters of the expense list were a `Disclosure` under the search field, a full-width "Filters (n)" toggle. Open, its panel is about 600 px tall: on a phone it pushes the list below the fold, and the toggle scrolls away while the person looks for the result, so closing it means scrolling back up. On a wide screen the content column is 40 rem at most, so the panel pushes the list down there too. The owner wanted the toggle to be a ghost icon button at the right of the search field. Three ways to open the panel were tried in Storybook at 320 px and 1024 px: the panel under the row at every width, a sheet at every width, and a sheet on a phone with the panel from 40 rem.

Every sheet could only be closed with its × or Escape. That protects a form whose edit is lost on closing, but a dialog that holds nothing to lose asks for a precise tap on a small corner.

## Decision

Confirmed by the owner:

- **The filters open in a sheet** (the `sheet` variant of `Dialog`, [ADR-0016](0016-forms-for-a-task-open-in-a-sheet.md)): from the bottom on a phone, a centered dialog from 40 rem, the same at every width.
- **The button** is a ghost icon button, the `filter_list` icon in a square of `--size-touch`, at the right of the search field on the same row. It is named "Filters", or "Filters (n)" while n filters are on, and shows n as a small number in its top right corner, out of the flow, so the icon never moves when filters come on or go off.
- **Applied live.** Each choice narrows the list at once; the sheet says "Showing x of y" as the person chooses, since the list is behind it.
- **The actions** sit at the foot of the sheet, stuck to its bottom edge while what it holds scrolls: "Clear filters" at the left (the filters of the sheet only, not the search nor the grouping) and "Close" at the right. There is no × and no Done: Close is the one way out besides Escape and a tap outside.
- **A tap outside closes a dialog that holds nothing that would be lost**: the filters, the add form (which keeps what was typed), the privacy notice, the question of deleting the account, the nickname prompt. Edit, Duplicate and Settle up do not, since closing them ends them; they close with their × or Escape as before. A dialog that can't be dismissed (something being sent from it) never closes either way.
- When the filters sheet closes, the focus goes back to the button. While the sheet is closed, the count on the button and the status line under the row say the list is narrowed; there are no chips. Its Clear is no longer a box as wide as the column under the line but a ghost button at the right of the line, on the same row.

This refines ADR-0016, which kept the list filters a disclosure and closed no sheet on a tap outside.

## Consequences

- The list never moves when the filters open, and the screen is the same on every device. From 40 rem the dialog covers the list it filters; the count inside the sheet stands in for it.
- The search field gets the width the full-width toggle took from the column.
- A sheet's actions are stuck to its foot, so a long sheet keeps them in sight on a small phone.
- No server, migration, API, outbox or sync change.

## Alternatives considered

- The panel under the row at every width: the list goes below the fold on a phone, and on a laptop too, the column being 40 rem.
- A sheet on a phone and the panel from 40 rem: two behaviours for one button, and the panel still pushes the list down on a laptop.
- The filters in a fixed side column from 64 rem: the only way to see the filters and the list at once, but it changes the layout of every screen; left for later.
- A tap outside closing every dialog: an accidental tap above a sheet would throw away an edit or a settlement half typed.
