# ADR-0010: Edit, duplicate and delete an expense without asking

- Status: Accepted
- Date: 2026-10-29

## Context

Logging an expense should take seconds and work one-handed. An edit, a copy or a delete must not add steps, and none of them may depend on the network.

## Decision

Confirmed by the owner:

- Editing a plan edits the whole plan, charged parts included.
- Edit replaces a new expense half typed in the form without asking.
- Delete keeps no confirmation. It can be taken back for a few seconds with Undo, and only the last delete can be undone.
- Adding an expense clears the search and the filters of the list, not its grouping.
- Duplicate loads the expense into the add form as a new one and saves nothing by itself. It replaces a half typed expense without asking.

An edit is the same idempotent `PUT /expenses/:id` as a new expense, one per row, through the outbox, so it needs no endpoint or migration and works offline ([ADR-0005](0005-offline-first-with-an-outbox.md)).

## Consequences

- A plan can be edited or duplicated only when every part of it is on the device.
- Known limits, acceptable for one person: a plan edited on two devices before they sync can end up with parts of both edits, and an edit made after a delete on another device brings the expense back.
- The details are in [expenses](../specs/expenses.md).

## Alternatives considered

Recurring expenses, not needed for now according to the owner (2026-10-29): duplicating an expense covers it.
