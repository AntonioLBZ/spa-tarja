# ADR-0043: The charts pick a category from the split and list what they count

- Status: Proposed
- Date: 2026-11-25

## Context

The owner wanted to see which expenses make a number of the charts. The first idea was to go from a category of the split to the expense list with that filter on, but the list counts by the day an expense was made and the charts by the day it counts on (`countedOn`: a credit card on the day it is charged, a plan part by part), so "Food, October" would hold other expenses and another total there. The list filter also takes one category, through a `Select`.

The stat row compared a range still running with as many days right before it: on 25 November the month read "1–25 Nov vs. 7–31 Oct", which is not November against October. The owner asked for the same days of the month before instead, which is also what the line of the summary that TODO 23 asked for would have said, so that line isn't added.

## Decision

- **The comparison follows the calendar.** A range of whole months is compared with as many calendar months right before it; any other range with as many days right before it, so whole weeks go back whole weeks. A range still running is compared from its start up to today, and the earlier span up to the same point: the same day of the month, or the last day of a shorter month, for months; as many days in for the rest. "1–25 Nov vs. 1–25 Oct"; on 30 March, March so far against the whole of February. The rule of 2026-10-29 (as many days right before, whatever the range) goes.
- **The split picks the category.** The category `Select` leaves the filters of the charts. Each row of the split is a toggle (`aria-pressed`): pressing it narrows the columns, the total, the comparison and the list below to that category, pressing it again lets go of it, one category at a time. The split itself still shows every category. A picked category that took nothing in a new range stays in the split at zero, last, so it can be let go of. The stat row names it ("Total in Food"), since the control is now at the foot. The picked row is told by shape: its name in bold and a `check` at its end.
- **What the chart counts is listed under it.** A last section, "Expenses", holds a ticket for each row of the chart (day, week or month) that has anything, newest first, each with what counts on it (by `countedOn`, at `countedCents`) and a foot "Total" that is its column. The rows look like those of the expense list and open nothing: no Edit, Duplicate or Delete. A part of a plan is a row of its own that says which part it is; an expense counted on another day than it was made says the day it was made; a shared row is your part and names its group; a settlement is never there. A hundred rows are drawn, and "Show more" adds a hundred.

## Consequences

- The numbers of the charts and the expenses under them always agree, ticket by column.
- Picking several categories at once needs a new shared control, a list of checkboxes, for the charts and for the filters of the list: left in the TODO.
- Editing stays in the list: changing an expense from the charts would move the numbers being read.
- A selected column doesn't narrow the list.

## Alternatives considered

- **Going to the expense list with the category and the dates as filters**: the list counts by the day made, so its rows and totals would not be the chart's.
- **A dialog or a page of its own for the expenses of a category**: the owner chose the foot of the screen.
- **The section folded in a `Disclosure`** ("Show the expenses"), like the table of numbers: one press more for what the screen is now for.
- **A flat list without tickets**: loses the ticket that adds up to its column.
- **Comparing a running month with the whole month before**: early in a month it reads as a big fall that isn't one ("↓ −90 %" on the 3rd).
