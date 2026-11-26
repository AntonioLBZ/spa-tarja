---
status: Accepted
date: 2026-11-21
refines: [ADR-0029]
tags: [balances, ledger]
specs: [balances.md, shared-expenses.md]
summary: 'Every row of a group''s balances starts folded, the person''s own too; Settle up is a small ghost `payments` action at the end of the label row of the balances (`Sheet` `action`), not a block button; the order of the ledger is tabs (`ChoiceGroup` `tabs`) at the end of the row of "Expenses"; refines ADR-0029.'
---

# ADR-0041: The screen of a group leads to its expenses

## Context

On a phone, the screen of a group spends its first screenful on what the person is owed: the balance in words, the sheet of the balances with the person's own row open (which says the balance a second time and adds a line per debt), a Settle up button as wide as the column, then the title "Expenses" and, under it, the order of the ledger as a legend and a row of boxes. The latest expenses, what people open a group to check, start below the fold.

## Decision

- **Every row of the balances starts folded**, the person's own too ([ADR-0029](0029-the-balances-of-a-group-fold-by-net-balance.md) opened it): the balance in words above the sheet already says it, and the lines under the row are one tap away. The order of the rows doesn't change.
- **Settle up is the action of the balances**, at the end of the row of the label of their sheet, a small ghost `Button` with the `payments` icon and a short word ("Settle up", "Saldar"), as the actions of the sections of Groups sit at the end of their heading ([ADR-0038](0038-making-a-group-is-a-screen-and-people-are-added-by-search.md)). It opens the same sheet as before; the button as wide as the column goes. The label stays centered; the `Sheet` takes an `action` for it.
- **The order of the ledger is tabs on the row of its title**: "Expenses" at the start and, at the end, Recently added and By date as underlined words (`ChoiceGroup` variant `tabs`, [ADR-0034](0034-the-add-form-chooses-who-it-is-for-in-tabs.md)), the legend "Order" read by assistive technology only. Still a radio group, still starting on Recently added, still there only once the group has an entry.

## Consequences

- The first expense of the ledger rises by about five rows on a phone.
- Under a pinned tab of Expenses the screen has two rows of tabs, the pinned ones as its title and the order of the ledger further down, smaller.
- A settlement that matches no line (paying ahead, between two who are even) still has a way in, the action of the sheet.

## Alternatives considered

- The balances as one closed row whose toggle is the balance in words: the most room, but who owes whom hides behind a tap.
- No Settle up but the one on each line: a payment that is no debt shown would have no way in.
- Settle up next to Edit group: under a pinned tab that row isn't there.
- One order only: Recently added and By date answer different questions, and both are used.
