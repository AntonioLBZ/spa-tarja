# ADR-0007: What counts in a month is worked out in one place, and derived, not stored

- Status: Accepted
- Date: 2026-10-25

## Context

An expense is made on its `date` but can count on another day: a credit card expense is charged later, and a restaurant card pays for you while others pay you back part of it.

## Decision

- Each expense counts on one day: its `charge_date` when it has one and its `date` otherwise, except for a restaurant card expense, which counts on the day it was made. What counts goes through the helpers in `core/counting.ts` in the summary, the charts and the budgets. `amount_cents` and `charge_date` are never read to add anything up.
- Your part of a restaurant card expense is what counts as spent. What the card paid for you is income of the month it is charged, and what others pay back is income of the month the expense was made. That income is derived when reading and never stored, so an expense stays one row and `PUT /expenses/:id` stays idempotent.
- The expense list is the exception, on purpose: it shows, filters, groups and adds up by the day made, so a subtotal can differ from the summary and the charts.
- The summary, the charts and the list are computed on the device from the local expenses, with no endpoint, so they work offline and see what is not synced yet.

## Consequences

- Your part of a restaurant card expense (migration `0008`) moved past months: before it, such an expense counted its whole amount as spent and as income, both in the month of its charge date. An old row has no part, so its spent and its card income stay its whole amount and nothing is paid back, but its spent moves from the charge month to the month it was made.
- Clients that don't send `payment`, `charge_date` or `personal_cents` write `direct`, no charge date and NULL, which is what they always meant ([ADR-0004](0004-data-conventions.md)).
- The rules are in [when an expense counts](../specs/expense-counting.md), [the expense list](../specs/expense-list.md) and [charts](../specs/charts.md).
