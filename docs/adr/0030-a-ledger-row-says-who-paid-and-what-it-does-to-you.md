# ADR-0030: A ledger row says who paid and what it does to you

- Status: Accepted
- Date: 2026-11-15

## Context

A row of a group's ledger showed the total of the entry as its amount and, in the details, who paid and "Your part €25.00". Reading the ledger, the owner wants to see at a glance what each entry did to their own balance in the group, which "your part" doesn't say: an expense they paid raises their balance by what the others owe, one somebody else paid lowers it by their part. A first try with two labelled columns per row (who paid the whole, and what it does to you) was too much to read; the row of the person's own list of expenses, one amount and a quiet line under the name, reads better.

## Decision

- **A ledger row is laid out as a row of the list of expenses** (the same classes): the badge and the name joined by a leader of dots to **one amount, what the entry does to your balance in the group**, an `Amount` with color and sign as the person allows ([ADR-0028](0028-amounts-show-which-way-they-go.md)) and never an arrow: "+€10.00" when you paid an expense (the others' shares), "−€1.67" when someone else did (your share). A settlement shows its amount neutral, with no color and no sign ("You paid Bruno", €11.00): paying a debt back is not earning, and a + on it read oddly. Every settlement has that shape, its whole amount on the right, also between two others, and its quiet line holds only its date and whether it is synced: its name says who paid whom, and a settlement counts for nobody, so "Not in it" would say nothing. It is set apart from an expense at a glance: name and amount smaller and quiet, and the `payments` icon of Settle up where an expense has the badge of its category, so every icon of the ledger lines up in one column (in the middle of the leader it landed at a different place on each row).
- **The quiet line under the name** says who paid the whole: "You paid €15.00", "Marcos paid €5.00"; a settlement of yours doesn't, as its name says it. When the entry doesn't move your balance there is no amount on the right and the line says why: "Just you" (you paid and the whole is yours) or "Not in it" (you neither paid nor have a share). The date and whether it is synced stay on that line; who wrote it last, when it was someone else, moves into the open row, under the breakdown, to keep the rows light.
- **One sentence for screen readers** per row, which reads the name, who paid and what it does to you ("Dinner: you paid €30.00 and lent €20.00.").
- **The total of a day** at the foot of its sheet adds up what its expenses do to you, as an `Amount` with color and sign, the sign read aloud: the net of the day for the person, not the whole amounts, which are on the quiet lines. Settlements count for nobody here, as they show neutral, so a day of settlements only has no total.
- **Opening a row** shows, before Edit, Duplicate and Delete, the breakdown of an expense: who paid with the whole, and each member's share, the person as "Ana (You)". A settlement has no breakdown: its row says it all. In a closed group an expense still opens, to its breakdown alone; a settlement there has nothing to open.
- Only the ledger of a group changes: a shared expense in the person's own list still shows their part as today.

## Consequences

- "Your part" leaves the details of the row; the breakdown has it.
- The ledger and the person's own list read alike, though their amounts mean different things: in the list, what counts for the person in the month; in the ledger, what moves their balance in the group.

## Alternatives considered

- The total alone, with no cue: says nothing of the person's balance.
- Two labelled columns, who paid the whole and what it does to you: both were there, but too much to read on a phone.
- The total of a day as the whole amounts: the quiet lines already say them, and the foot of the sheet then disagreed with the amounts above it.
