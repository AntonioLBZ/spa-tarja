# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## 17. Revisar junto al owner los componentes, a11y y diseño

El owner pedirá cambios en diferentes componentes llegado el momento, ir de la mano paso a paso.

Los componentes que sean el "mismo" pero diferente, reusar el mismo pero con diferentes size o variants.

The design system is in Storybook now (`pnpm storybook`, [ADR-0011](docs/adr/0011-design-system-in-storybook.md)): the stories and their accessibility panel are where to start. What is left of this item, with the owner. Done on 2026-11-01: the update toast, the swatch pickers, the rings of `ChoiceGroup`, `Select` and `Dialog`, the ghost buttons, the hints and the categories screen on sheets.

- **Stories of the groups.** None yet for Settle up, the Leave and Delete panels, the steps of a person, `InvitationLink` or `InviteFriend`; the ledger row has one (`Features/LedgerRow`).
- **`:focus-visible` of the rest.** The ring of `ChoiceGroup`, `Select` and the `Dialog` is done. What is left is the global one, on buttons, links and fields: with the gray accent it sits next to the ink edge and may be hard to tell apart, which only the owner's eye can say. A throwaway story that forces the focus on each component, to look at every accent in light and dark, would settle it.

## 21. A note on an expense (analysis first)

An optional free text on an expense. Analyse before building: where it shows (list row, detail, search), whether shared entries get one too (today their text is empty for settlements), what the export carries, and the length limit. The migration only adds a column.

## 23. Compare months in the Summary

A line in the Summary that compares the month so far with the same days of the month before ("15 % more than October at this point"). The charts already compare spans (`comparison`, `previousRange`): reuse it.

## 25. Frequent expenses (analysis, likely dropped)

When the "+" opens, offer the 3 or 4 texts the person types most, to fill the form in one press. Not recurring expenses ([ADR-0010](docs/adr/0010-edit-duplicate-and-delete-expenses.md)). Analyse whether it earns its place in the form; the owner will probably drop it.

## 26. Remind a debt with a push

In the balances of a group, a "Remind" on a debt you are owed sends a Web Push to the debtor, on their devices that allow it. Needs an ADR that refines [ADR-0025](docs/adr/0025-shared-expenses-notify-the-people-they-concern.md): how often one can remind (a limit per pair and day), what the push says, and that it needs a connection.

## 27. Export a group, import, and a printable view

- **Export one group** to CSV, from the group's screen, for people who don't use the app.
- **Import** a backup (the JSON of the export). Out of scope today ([ADR-0001](docs/adr/0001-scope-of-the-app.md), [ADR-0012](docs/adr/0012-shared-expenses.md)): a new ADR first, deciding what is imported (own expenses, categories, budgets; never groups), and how ids and conflicts are handled.
- **A printable view**: a new page for a group or for your expenses over a range, laid out for printing or saving as PDF from the browser (`@media print`).

## 28. Empty states and the first run

Go over what a new person sees on every screen: no expenses, no groups, no friends, no budget, no income. Each empty screen says what it is for and offers the one action that fills it.

## 31. Add "Filters" to a group's screen

Offer the filters of the expense list ([ADR-0024](docs/adr/0024-the-list-filters-open-in-a-sheet.md)) on the screen of a group, for its ledger. Decide first what a group can be filtered by (who paid, who is in it, category, range, settlements) and update `docs/specs/expense-list.md` and `docs/specs/groups.md` before building.

## 18. More locales

Locales beyond `en` and `es` (the owner's `spa-anicalendar` also ships `fr` and `de`) come among the last things, not now.
