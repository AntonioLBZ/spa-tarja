# ADR-0045: Your expenses print as the list shows them

- Status: Accepted
- Date: 2026-11-24

## Context

A group prints as one table, the same for everyone ([ADR-0044](0044-a-group-is-exported-as-one-table-the-same-for-everyone.md)). The owner wants the same for a person's own expenses, from the account, next to downloading the data. The CSV there lists each part of a plan as a row of its own and is made for a spreadsheet; the list collapses a plan into one row at its full price on the day it was made and adds up by the day made ([the expense list](../specs/expense-list.md)).

## Decision

- **A page of its own**, `/settings/account/print`, reached from a third action of Your data, "Printable view", after the two files; its way back leads to the account.
- **The rows of the list, as the list shows them**: the person's own expenses and their part of the shared ones of the groups that show in their expenses (with the group's name), a plan as one row at its full price on the day it was made, a restaurant card expense at the person's part; settlements are not rows. One table, the oldest first, and a last row, Total, which is what the list's subtotals add up to, by the day made, so it can differ from the summary as the list does.
- **The filters of the list**: its search and its sheet (category, From and To, how it was paid, who it is shared with), without the grouping; it opens on the month the list opens on, so a whole history doesn't go to paper by default. The caption says the days and each filter in use, and is printed.
- **Print only**: the CSV of the account stays the one file of the expenses; a CSV of this table would be a second format of the same data.
- The page and the table of a group share one component, `PrintTable`, and the rules on paper.

## Consequences

- What is printed matches what the person sees in the list, not the CSV: a plan is one row there and twelve in the file.
- The person's side is in it (their part, their payment), unlike the table of a group, which is the same for everyone.

## Alternatives considered

- **One row per part of a plan, as the CSV**: the same rows as the file, but not what the list shows, and longer on paper.
- **Opening on everything**: simpler, but a long history would print pages nobody asked for.
- **A CSV of the table too**: a third format of the expenses, with plans collapsed, beside the one that exists.
