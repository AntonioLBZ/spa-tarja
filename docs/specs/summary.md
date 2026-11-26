---
tags: [summary]
adrs: [ADR-0028, ADR-0033]
code: [core/reports/, src/features/summary/]
summary: 'The summary of a month: income, the restaurant card, what others paid back, spent and left, the income form and the bars of the limits, with your part of the shared expenses and no settlement.'
---

# Summary

- `/summary`, linked from the header, shows one month at a time. It opens on the current month, whose name sits between two arrow buttons (previous and next, at least `--size-touch` wide); the month isn't in the URL.
- The month's numbers are `Card` rows, each its bottom edge ([ADR-0033](../adr/0033-a-card-is-its-bottom-edge.md)): income (what the person set, or "Not set"), restaurant card (what the card paid for you of the expenses charged in the month, only when there is some), paid back by others (what others paid back of the restaurant card expenses made in the month, only when there is some), spent, and left. Left is the row that matters: bold, an `Amount` with the color and the sign the person allows ([ADR-0028](../adr/0028-amounts-show-which-way-they-go.md)): "+€270.00" in `--color-money-in` while something is left, "−€35.00" in `--color-money-out` below zero, the sign read aloud since no word says it, and the plain minus of the locale below zero when the sign is off; zero has no cue. The other rows have none. It stays hidden, with a hint, until the income is set. The rows are `--size-2` apart, as in the category list, and the arrows of the month and the income field with its buttons are `--size-4` apart, also when the income row wraps.
- Under the rows, one form sets the income: an amount field (`required`, with the browser's own validation off, so assistive technology says it is needed and the message of the form is the only one) and Save, and Remove once there is one. Setting it needs a connection ([when an expense counts](expense-counting.md)), so offline the form is disabled, the field as well as its buttons, and says why; the numbers themselves still show from the local copy.
- Under the numbers come the bars of the limits ([budgets](budgets.md)). Two links at the bottom lead to the budgets and to the charts, `--size-4` apart.
- The numbers include your part of the shared expenses ([when an expense counts](expense-counting.md)). A settlement is not in them.
