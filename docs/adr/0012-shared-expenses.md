# ADR-0012: Shared expenses: a group is a ledger its members share

- Status: Proposed
- Date: 2026-11-01

## Context

[ADR-0001](0001-scope-of-the-app.md) left shared expenses out and kept the idea in `TODO.md`, warning that every row belongs to one user and that it would change the model. The owner now wants it: split an expense with other people, keep an account per group of who owes whom, settle up, and split with someone who doesn't use the app.

## Decision

**Scope.** In: groups, expenses split between their members, balances, settling up, and splitting with one person without making a group. Still out: importing a backup and several currencies (a group has the app's currency). Still decided from [ADR-0001](0001-scope-of-the-app.md): export only, which now holds the groups too, and no PWA shortcuts. Left for later, on purpose: several people paying one expense (the owner sees no use for it), splits by shares or weights, recurring shared expenses ([ADR-0010](0010-edit-duplicate-and-delete-expenses.md)), receipts, comments, notifications of any kind ([ADR-0009](0009-budgets-only-warn.md) drew the same line), paying through the app and merging anything but a dummy into a real member ([ADR-0014](0014-people-in-groups.md)).

**Model.**

- A group has **members**: signed-in users, or **placeholders**, names nobody has claimed yet ([ADR-0014](0014-people-in-groups.md)). Its **entries**, expenses and settlements, belong to the group, not to a user. A user is in many groups and a group has many users. Personal expenses stay as they are ([ADR-0004](0004-data-conventions.md)).
- An entry says who paid and how the amount is divided between members, in cents: equally by default, by percentage, by exact amounts, with the option to leave someone out.
- A **friend** is a group of two with no name: the maker and a real person who accepted their invitation, or a dummy. Splitting with a person outside any group is an expense in that group: same engine, same screens, and it can't grow. A group holds dummies, added by name, and friends, added from the friend list ([ADR-0014](0014-people-in-groups.md)); there are no invitations to a group.
- Roles are `owner` and `member`. Any member adds, edits and deletes entries and adds dummies and their own friends. Only the owner renames the group, removes others, switches the simplified debts and deletes it.
- A member row is never deleted; leaving sets `left_at` and the entries keep naming them. Leaving, removing and deleting need the balances involved to be zero. Settling up is always possible between any two members, so nobody is stuck.
- A member sees the whole history of the group, also from before they joined.

**What counts.** Your part of a shared expense counts as spent on the day it was made, whoever paid, as the part you keep of a restaurant card does ([ADR-0007](0007-what-counts-in-a-month.md)). A settlement counts for nobody: not spent, not income. Your part is derived on the device from the entries and never stored as a personal row; it enters the lists as an expense, so the summary, the charts and the budgets count it through the same helpers. The payer may have paid with a credit card or a restaurant card, and then their own row counts as it would for an expense of theirs alone (the charge date, the card income); for everybody else it counts as paid now, on the day it was made. Installments are not offered.

**Debts.** A member's balance is what they paid plus the settlements they made, minus their parts; a group's balances add up to zero and are worked out, never stored. A group shows by default who owes whom, pair by pair. The owner can switch **simplified debts** on: the same balances as the fewest payments, a way to read them, never a rewrite of entries. It is a setting of the group, so every member reads the same payments, and it is off by default. A settlement is an entry: any member records that one member paid another at least one cent, possibly more than the debt, which turns the debt the other way round.

## Consequences

- [ADR-0001](0001-scope-of-the-app.md) is superseded by this one. Its text stays as it was.
- Deleting a group deletes no expense. A group that was deleted, or that a person left, becomes **closed**: read-only, and its expenses stay in each person's own expenses for as long as that person keeps it on, with a switch per group and per person, "Show in my expenses". A person can also archive a closed group to tuck it away ([groups](../specs/groups.md)).
- A shared expense can only use the default categories, which every member has. Whether the set of defaults should grow (trips, treats and the like) is a review of its own, apart from this work (`TODO.md`).
- With simplified debts off, a big group shows many small debts; on, a few payments that may name someone you shared nothing with. Each has its place, which is why it is a choice.
- The maths (splitting, balances, simplifying) lives in `core/` and the server uses it too, to refuse leaving or deleting with a balance.
- The rules are in [groups](../specs/groups.md), [shared expenses](../specs/shared-expenses.md), [balances](../specs/balances.md) and [when an expense counts](../specs/expense-counting.md). The offline rules are in [ADR-0013](0013-shared-entries-sync-through-an-outbox.md).

## Alternatives considered

- **A personal expense row per participant**: other users' rows would be written by someone else, which the access rule forbids, and an edit would fan out to every row.
- **Group fields on `expenses`**: a row with several owners; every query by `user_id` would change.
- **Friends as their own concept** with their own tables and balance: two engines to keep equal.
- **A cash view** (what each person paid): a dinner would weigh a whole month on whoever paid, and every settlement would count as income or as spent.
- **Always simplified debts**, or a switch per device: a debt may name someone you never shared with, and two members would be told different payments for one group.
