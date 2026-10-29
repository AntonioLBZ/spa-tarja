# ADR-0005: Offline-first, with an outbox for expenses

- Status: Accepted
- Date: 2026-10-25

## Context

Expenses are logged on the go, so a save must never wait for the network. The app was online first and the offline queue arrived in its own phase. Safari has no Background Sync, so nothing can depend on it.

## Decision

- An expense id is a UUID made on the client and is the primary key. `PUT /expenses/:id` creates the row or updates it, only when it belongs to the caller: an existing id owned by another user is rejected, never overwritten. Retrying is therefore safe.
- A delete is soft: the same `PUT` with `deletedAt` set. There is no `DELETE` route for expenses.
- A save goes into the outbox, an IndexedDB record of the latest version of each unsynced expense. The screen shows the cached server data with the outbox on top. An entry leaves the outbox only when the server answered it, and only if it wasn't edited meanwhile.
- Conflicts: the last edit wins by `updatedAt`, the device's clock. The server applies a write only when its `updatedAt` is strictly newer than the stored one.
- Sync pages through the server's changes by `seq`, a per-user counter the server bumps on every write, never by `updatedAt`.
- The sync is the `queryFn` of the `expenses` query, so every trigger TanStack Query already has (open, focus, reconnect, invalidation after a save) runs the same path.
- The exception: custom categories, the monthly income and the budgets need a connection to be changed. They are read from the persisted cache.

## Consequences

- No API may depend on the server assigning ids.
- A device whose clock runs behind loses to rows written ahead of it, silently. An edit or an undo takes an `updatedAt` later than the version it replaces for that reason ([expenses](../specs/expenses.md)).
- Custom categories, income and budgets can't be changed offline, and an expense is never refused for its category ([ADR-0006](0006-categories.md)).
- The details are in [offline sync](../specs/offline-sync.md) and [data model](../specs/data-model.md).

## Alternatives considered

- Syncing by `updatedAt`: an edit made offline last week arrives with an old `updatedAt`, and a device whose cursor is already past it would never pull it.
- A second outbox for categories, income and budgets: they change a few times a year, and it would need its own ordering, so it would buy little.
