# Groups on the Device (item 23) Implementation Plan

**Goal:** The client data layer of groups, no screens (items 24 and 25): the typed API client for every group, member and entry route, the `groups` and `group-entries` queries in the persisted cache, a second outbox for the entries of groups, the sync of each group by its own cursor, a `createFakeApi` that holds groups, and the hooks the screens will call.

**Architecture:** The outbox becomes generic over what it holds and the key it is stored under, so the second outbox is the same code (`tarja:group-outbox:<user>`); its refusals keep their item and the server's code, so a screen can say which entry and why (`clock-ahead`: check the clock). The push loop and the one-sync-at-a-time guard of `sync.ts` become shared pieces; `group-sync.ts` is the `queryFn` of `['group-entries', groupId]`: push the group's pending entries in order, then pull its pages after its cursor. A `409 closed` marks the group closed in the `groups` cache and asks the server again. `features/groups` holds the hooks: the groups and their ledgers (the cache with the pending entries on top), your part of them as rows (`core/shared-expense.ts`), the structure actions (online only, a closed group read-only) and the entry actions (to the outbox, delete with Undo).

**Spec:** `docs/specs/offline-sync.md`, `groups.md`, `shared-expenses.md`, `authentication.md`, ADR-0005, ADR-0013.

## Choices where the docs are open

- A change that needs a connection is refused before any request while `onlineManager` says offline, with a `LocalRefusal` (`offline`); a closed group refuses the same way (`read-only`), except the person's switches, which the server takes on a closed group.
- A `409 closed` on an entry marks the group `closed: 'deleted'` in the cache until `GET /groups`, asked at once, says which; the answer carries no reason.
- Leaving pushes and pulls the group, and also stops when the outbox still holds an entry of it afterwards (one written meanwhile), with `LocalRefusal('unsynced')`. Deleting a group does not push first: the spec asks it of leaving only.
- The group outbox holds the entry as it is sent plus its `groupId`; the ledger shows a pending entry as written by the person (`updatedBy` their member).
- The personal outbox drops `400`, `409` and `422` as the code does; `offline-sync.md` says `400` or `409`, and is fixed.

## Tasks

### Task 1: One outbox, two per user

- Modify `core/expense-merge.ts` (+ test), `src/lib/offline/outbox.ts`, `outbox-context.tsx`, `user-data.tsx`, `user-storage.ts`, `sync.ts`, `index.ts`, `src/lib/test/render-app.tsx`, `src/features/expenses/sync-status.tsx`, `src/features/auth/account.tsx`, their tests.
- Produces: `upsertById<T extends { id: string }>`; `createOutbox<T extends OutboxItem>(storage, key): Outbox<T>`, `OutboxState<T> { pending; rejected: readonly Rejection<T>[] }`, `Rejection<T> { item: T; code: string | null }`, `reject(sent, code)`; `GROUP_OUTBOX_STORAGE_KEY`; `type PendingEntry = SharedEntry & { groupId: string }`; `useGroupOutbox(): Outbox<PendingEntry>`.
- Tests: two outboxes on one storage never see each other; a refusal keeps the item and its code; discarding removes the group outbox; signing out keeps everything while the group outbox holds an entry; another account on the device gets an empty group outbox and the first one's stays stored.
- Commit: `feat: keep a second outbox for the entries of groups`

### Task 2: The API client and a fake Worker with groups

- Create `src/lib/api/groups.ts`, `group-entries.ts` and their tests. Modify `src/lib/api/queries.ts`, `index.ts`, `src/lib/test/fake-api.ts`.
- Produces: `GROUPS_KEY`, `fetchGroups()`, `putGroup(groupId, NewGroup | GroupChange)`, `deleteGroup`, `putMember(groupId, memberId, MemberWrite)`, `deleteMember`, `mergeMember(groupId, memberId, into)`, `handOver(groupId, memberId)`, `putMySwitches(groupId, MySwitches)`, each answering `SharedGroup`; `groupEntriesKey(groupId)`, `GroupEntriesState`, `fetchEntryChanges(groupId, after)`, `putEntry(groupId, SharedEntry): Promise<LedgerEntry>`; `groupsQuery()`. The fake: groups as the test user sees them, a cursor per group, last write wins, `409 closed`, the cut at `left_seq`, a refusal of group or entry writes with a status and a code, writes that land with their answer lost, and `hold()` to keep requests waiting.
- Tests: each call sends its request and answers what the server kept; a refusal is an `ApiError` with status and code.
- Commit: `feat: add the client of the groups and their entries`

### Task 3: The sync of a group

- Create `src/lib/offline/group-sync.ts` (+ test). Modify `sync.ts`, `persister.ts` (+ test), `index.ts`.
- Produces: `groupEntriesQuery(outbox, groupId)`, `syncGroup(client, outbox, groupId): Promise<GroupEntriesState>`; the persisted cache keeps `groups` and `group-entries`.
- Tests: pages after the group's own cursor until `hasMore` is false; pushes only that group's entries, in order, before pulling; the same write twice changes nothing; a write whose answer was lost is sent again without a duplicate, and the rest of the push waits in order; each permanent refusal (`400`, `403`, `404`, `409 closed`, `409 id-taken`, `422` of every code) drops the write, keeps its code and leaves the stored version; `409 closed` marks the group closed; `5xx`, `401` and a dropped connection keep it; overlapping syncs send once; a pull that lands after a newer local write leaves the write on top and in the outbox; the persisted cache keeps the two queries and nothing else new.
- Commit: `feat: sync the entries of each group by its cursor`

### Task 4: Groups and ledgers on the device

- Create `src/features/groups/use-ledgers.ts`, `use-shared-expense-rows.ts` (+ tests). Modify `src/lib/test/render-app.tsx` (`renderAppHook`), `src/features/expenses/use-expenses.ts` (the retry interval shared from `lib/offline`).
- Produces: `useGroups()`, `useLedgers(): Ledger[]` (`group`, `entries` with the pending ones on top, `hasData`, `isError`, `isWaitingForNetwork`) and the pending ids; `useSharedExpenseRows(): SharedExpenseRow[]`.
- Tests: the ledgers come from the local copy with the server out of reach; a pending entry shows on top and is marked pending; reconnecting delivers it; rows only for the groups whose switch is on, closed ones included; a share of a placeholder merged into you is your part; two users on one device never see each other's groups or entries.
- Commit: `feat: read the groups and their ledgers on the device`

### Task 5: Changing a group

- Create `src/features/groups/local-refusal.ts`, `use-group-actions.ts` (+ test).
- Produces: `LocalRefusal { code: 'offline' | 'read-only' | 'unsynced' }`; `useGroupActions()` with `createGroup`, `createFriend`, `change`, `savePerson`, `addFriend`, `removeMember`, `merge`, `handOver`, `remove`, `leave`, `setSwitches`, each answering the group and putting it in the cache.
- Tests: offline every action is refused and nothing is sent; a closed group refuses all but the switches; each answer lands in the cache; a server refusal keeps its code; leaving pushes and pulls the group first, and stops (nothing sent to leave) when the push or the pull fails or an entry is still waiting.
- Commit: `feat: add the actions that change a group`

### Task 6: Writing entries

- Create `src/features/groups/use-entry-actions.ts` (+ test).
- Produces: `useEntryActions()` with `save(groupId, entry)`, `remove(groupId, entry): Promise<SharedEntry>` and `restore(groupId, deleted)`.
- Tests: a write is in the ledger at once and in the outbox offline, sent once back online; a closed group, a group the person left and an unknown group refuse it before the outbox; delete and Undo each take an `updatedAt` later than the version they replace, and Undo while the delete waits sends only the restored entry.
- Commit: `feat: add writing and deleting the entries of a group`

### Task 7: Close

- Update `docs/specs/offline-sync.md`, `AGENTS.md` if a rule changed; delete this plan and item 23 of `TODO.md`.
- Commit: `docs: close the groups on the device`

## Review Focus

- The provisional `closed: 'deleted'` after a `409 closed` can say "Deleted" to a person who was removed, until `GET /groups` answers.
- `GET /groups` replaces the cached list whole: a group missing from an answer would vanish from the device with its ledger cached and unread (the server never drops one).
- An entry written between the push of a leave and its `DELETE` is refused with `409 closed` once the person has left; the screen is expected to block writing while leaving.
- Deleting a group doesn't push its outbox first: an unsynced entry of the owner is refused with `409 closed` afterwards.
- Every group is synced on every trigger, one request each, closed ones included.
