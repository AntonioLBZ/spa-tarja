# ADR-0009: Budgets warn inside the app and never block

- Status: Accepted
- Date: 2026-10-29

## Context

A limit for the month's total and for each category, with bars in the Summary and a warning when an added expense crosses one. An open question about a credit card whose charges pile up in a month is closed by [ADR-0007](0007-what-counts-in-a-month.md): a credit card expense counts in the month it is charged, and a warning says which month it speaks of.

## Decision

Owner decisions:

- A limit for the month's total and one for each category.
- Warnings inside the app only, never a push.
- A budget never blocks anything: it only warns.

And the shape of a limit:

- A limit holds for the following months until one sets another. An amount of 0 means no limit from that month on, and it is stored: deleting the row would make the month hold the earlier limit again.
- A limit is an amount. A percentage is shown, never typed or stored.

## Consequences

- Changing a limit needs a connection ([ADR-0005](0005-offline-first-with-an-outbox.md)); the bars and the warnings work from the local copy.
- The rules for thresholds, warnings and the API are in [budgets](../specs/budgets.md).
