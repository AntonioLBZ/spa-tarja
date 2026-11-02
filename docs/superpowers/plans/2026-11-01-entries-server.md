# Entries Server (part B of item 22) Implementation Plan

**Goal:** The two routes of the entries of a group on the Worker, `PUT /groups/:groupId/entries/:id` and `GET /groups/:groupId/entries?after=&limit=`, with every check of the specs and tests for several users. Nothing on the device (item 23).

**Architecture:** `core/shared-entry.ts` gains the id of an entry (a UUID read in lower case), the stored shape the routes answer (`LedgerEntry`: the entry plus who made it and who wrote it last, as their members in the group) and timestamps that are safe integers. `server/db/entries.ts` reads one entry by id in any group (`readEntry`), writes one in a single statement that takes the next `seq` of the group and only runs while the caller is a member who hasn't left an open group (`upsertEntry`), and pages through the changes of a group cut at a `left_seq` (`listEntryChanges`). The writers are turned into member ids inside SQL, so no user id leaves the database layer. `server/routes/entries.ts` holds the two thin handlers, mounted at `/groups` behind `withUser`, reusing `NOT_FOUND`, `CLOSED`, `readGroup` and `closedFor` of part A, and the page query of the expenses.

**Spec:** `docs/specs/shared-expenses.md` (Writing, Reading), `docs/specs/groups.md` (closed groups, API), `docs/specs/offline-sync.md`, `docs/specs/data-model.md`, ADR-0012, ADR-0013, ADR-0014.

## Choices where the docs are open

- The answers carry `createdBy` and `updatedBy` as the members of those users in the group (null once the account is deleted): the specs say the server adds them as user ids, and that no answer holds a user id; the columns stay user ids. `shared-expenses.md` is fixed.
- The page is `{ entries, cursor, hasMore }`, the size and the limits of the expenses (200 by default, 500 at most).
- A write to a closed group answers `409 closed`, except this very write sent again once it landed (the stored entry has its `updatedAt` and the caller reads that version), which answers the stored entry, as part A answers a write whose effect is there.
- `409 id-taken` comes before `409 closed`; the content checks only run for an open group: `400 unknown-category`, then `422 currency-mismatch`, `unknown-member`, `member-left`.
- Members are compared as `canonicalMember` reads them: a merged placeholder is its target, and "already in the stored entry" means its payer or a share, deleted or not, as their canonical members.
- The write checks the caller's member and the group in the same statement that writes it, so a leave or a delete between the checks and the write can't let it land.
- Timestamps are safe integers: `Number.isInteger(1e300)` holds, and such a number would be stored as a real and lock the entry.

## Tasks

### Task 1: The id and the stored shape of an entry in core

- Modify `core/shared-entry.ts`, `core/shared-entry.test.ts`.
- Produces: `entryIdSchema` (UUID, lower case), `type LedgerEntry = SharedEntry & { createdBy: string | null; updatedBy: string | null }`; `timestamp` becomes a safe integer.
- Tests: an id in upper case reads as lower case, a non-UUID is refused; `createdAt`, `updatedAt` and `deletedAt` past `Number.MAX_SAFE_INTEGER` are refused.
- Commit: `feat: add the id and the stored shape of a shared entry to core`

### Task 2: Writing an entry

- Create `server/routes/entries.ts`, `server/routes/entries.test.ts`, `server/db/entries.test.ts`. Modify `server/db/entries.ts`, `server/db/groups.ts` (`leftSeq` on `StoredMember`), `server/app.ts`, `docs/specs/shared-expenses.md`, `docs/specs/data-model.md`.
- Produces: `readEntry(db, id): Promise<StoredEntry | null>` with `StoredEntry { groupId; seq; entry: LedgerEntry }`, `upsertEntry(db, writer: { groupId; id; userId }, input): Promise<LedgerEntry | null>`; `PUT /groups/:groupId/entries/:id`.
- Tests (route): creates and answers the entry with the writers as members; an id in upper case is the same entry; the same write again changes nothing, also three at once; a newer write applies and records its writer, an older one answers the stored entry; a delete is a tombstone; another member edits; `400` for bad shapes, shares that don't add up, two receivers, huge numbers, a custom category (`unknown-category`); `422 currency-mismatch`, `unknown-member`, `member-left` (a new share or payer who left), allowed for one already in the stored entry and for a merged placeholder whose target is in; `409 id-taken` for an entry of another group, which stays as it was and isn't told; a stranger gets the byte-identical `404` of a missing group; `409 closed` for a deleted group and a member who left, before any other check, and a landed write sent again answers the entry; the row matches what `seedEntry` writes; no answer holds a user id or an email; nothing reaches `expenses`. (db) `upsertEntry` writes nothing for a stranger, a member who left or a deleted group, never changes an entry of another group, and takes the next `seq` of its group.
- Commit: `feat: add writing an entry of a group`

### Task 3: Reading the entries by the cursor

- Modify `server/db/entries.ts`, `server/routes/entries.ts`, `server/routes/expenses.ts` (export the page query), the tests, `docs/specs/shared-expenses.md`.
- Produces: `listEntryChanges(db, groupId, after, limit, until: number | null): Promise<EntryChanges>` with `EntryChanges { entries: LedgerEntry[]; cursor; hasMore }`; `GET /groups/:groupId/entries`.
- Tests: empty with cursor 0; pages with `limit` and `after`; tombstones after the cursor; an edit moves past the cursor; only this group's entries, also for a member of both; seq strictly increasing per group and independent between groups under `Promise.all`; a member who left reads up to `left_seq` and never an edit made after; the members of a deleted group read all; a stranger gets the same `404`; bad queries are `400`.
- Commit: `feat: add reading the entries of a group by its cursor`

### Task 4: What a member who left reads

- Modify `docs/specs/offline-sync.md`, `docs/specs/groups.md`, `docs/specs/shared-expenses.md`, `AGENTS.md`, `TODO.md` (items 23 and 24).
- The ruling: the cut stays `seq <= left_seq`, so a person who left keeps the version their device holds and never sees a later edit, nor an entry their device hadn't pulled; leaving needs a connection, and the device pushes its outbox and pulls the group before it asks to leave.
- Commit: `docs: settle what a member who left reads of later edits`

### Task 5: Close

- Delete this plan and item 22 of `TODO.md`; check `AGENTS.md`, `groups.md`, `data-model.md` and `offline-sync.md` agree.
- Commit: `docs: close the groups on the server`

## Review Focus

- A member can lock an entry against edits with an `updatedAt` far in the future (up to the largest safe integer); the specs accept the device's clock as the judge, as for a personal expense.
- `unknown-member` and `member-left` are read before the write, not in it: a member who leaves between the check and the write can still be named (the specs accept a late entry leaving a balance on someone who left).
- The number of shares has no cap of its own: each must be a member of the group, and the checks are linear.
- `kind` can change on an edit (an expense to a settlement); the specs don't forbid it and the client doesn't do it.
- A write to a closed group that is stale, not a retry, answers `409 closed` even though in an open group it would answer the stored entry.
