# ADR-0021: Pinned groups

- Status: Accepted
- Date: 2026-11-12

## Context

A person who shares most of what they spend in one or two groups (a flat, a partner) goes to Groups and then to the group many times a day, though the Expenses screen is where the app opens. The owner wants those groups one tap away from Expenses, without turning Expenses into a filter of the group and without the notch, since a row of tabs is not a box that stands alone. Three looks of the row were tried side by side in Storybook at 320, 390 and 640 px.

## Decision

Confirmed by the owner:

- **A person pins a group or a friend** for themselves, and unpins it. It is theirs, like Show in my expenses and Archive ([ADR-0012](0012-shared-expenses.md)): kept on the server, on their member of the group, so every device of theirs shows the same, and changing it needs a connection, like everything that shapes a group ([ADR-0013](0013-shared-entries-sync-through-an-outbox.md)).
- **Only an open group** can be pinned. A pinned group that closes for the person (deleted, left, removed, a friend removed) stops being pinned, and coming back to it does not pin it again.
- **At most two** pinned at a time. With two pinned, the control that pins another is off and a short text says why; the server refuses a third all the same.
- **The title of the Expenses screen becomes a row of tabs** while something is pinned: Expenses first, then the pinned groups in the order they were pinned. The row never wraps: Expenses keeps its width and a long name is cut with an ellipsis. The current tab is in ink with the bar of `--size-1` in ink under its word, as the current word of the header; the others are in secondary text. No notch, no rule under the row.
- **A tab shows the group itself**, as its own screen does (balances, settle up, the ledger), not a filter of Expenses. While it is shown the "+" starts an expense in that group, as it does inside the group ([ADR-0016](0016-forms-for-a-task-open-in-a-sheet.md)).
- Where to pin: in the group's settings, and on each open group and friend of the Groups screen, with a small pin that fills when the group is pinned.

## Consequences

- An additive migration: `pinned_at` on `shared_members`, null when not pinned. The groups the server answers carry `pinnedAt` for the person, null for a group closed for them.
- The tab of a group is the Expenses screen with the group in the address, so it keeps the Expenses tab of the bottom bar and the header, has no link back, and the browser's Back goes from one tab to the previous one.
- The JSON export says whether each group is pinned, as it says the other switches.
- At 320 px two pinned groups leave each name about ten characters before the ellipsis; three would have left about four, which is why the limit is two.

## Alternatives considered

- Pins kept on the device only: each phone and computer would show different tabs, unlike every other switch of a group.
- A tab that filters the expense list to the person's part of the group: the group already has a screen, and the owner wants that one.
- Underlined words over a hairline, or the current tab as a larger title with smaller words beside it (`Lab/Pinned group tabs`): the hairline adds a rule the header already draws, and the title look changes the size of a word as the tab changes.
- Three pinned groups: unreadable at 320 px.
