# ADR-0013: Shared entries sync through an outbox; the shape of a group needs a connection

- Status: Proposed
- Date: 2026-11-01

## Context

Splitting a dinner happens at the table, often with a poor signal, and the app must work offline ([ADR-0005](0005-offline-first-with-an-outbox.md)). But a group has several writers, and who is in it and who may write is decided by the server.

## Decision

- Entries (expenses and settlements) follow [ADR-0005](0005-offline-first-with-an-outbox.md) with the group as the scope instead of the user: the id is a UUID made on the client, `PUT /groups/:groupId/entries/:id` is idempotent, a delete is soft, the later `updatedAt` wins, and a device pulls the changes of each group by that group's `seq` counter.
- Entries go through a second outbox, the same code over another key, stored under the signed-in user like the first. Saving never waits for the network.
- What needs a connection, like the custom categories, the income and the budgets: making, renaming and deleting a group, adding, renaming, removing and leaving members, invitations, merging a dummy, the nickname, the Show in my expenses switch, the simplified debts switch and deleting the account. They are done rarely and decide who may do what.
- The server checks on every write that the caller is a member and that the entry names only members of that group. An entry it refuses for good (the group is gone, the caller left, a member is unknown) is dropped from the outbox and the person is told, as for an expense. A group the caller is not in answers `404`, so its existence isn't told.
- A shared entry names a default category, which the server does check, unlike for a personal expense ([ADR-0006](0006-categories.md)): default categories are never deleted, so the check can't race with a delete on another device.

## Consequences

- Known limits, acceptable for friends: two people editing one entry before they sync end with the later edit, and an entry written offline for a member who has since left is refused.
- A device pulls once per group on every sync: one request per group, well inside the free tiers for a handful of groups ([ADR-0003](0003-spa-on-one-worker-on-free-tiers.md)).
- Nothing is pushed to other devices. A change by someone else arrives when this device opens the app, gets the focus, reconnects or saves.
- The details are in [offline sync](../specs/offline-sync.md) and [data model](../specs/data-model.md).

## Alternatives considered

- **Everything online**: logging the dinner would fail exactly where it happens.
- **One outbox for expenses and entries**: it would change the stored format of an outbox that holds data on every device, to save one small factory call.
- **A log of operations (CRDT)**: far more than a group of friends needs.
