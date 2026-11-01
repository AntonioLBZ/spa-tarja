# Groups Server (part A) Implementation Plan

**Goal:** The tables of groups, members and entries (migration `0011`) and every route of groups, friends and members on the Worker, with their checks. No entry routes (part B), no invitations (item 26), nothing on the device.

**Architecture:** One migration with `shared_groups`, `shared_members` and `shared_entries` as `docs/specs/data-model.md` defines them. The schemas of every body live in `core/shared-group.ts`, shared with the client. `server/db/groups.ts` reads a group as the caller sees it (the group, its members in the group's order and the caller's member) and writes groups; `server/db/members.ts` writes members; `server/db/entries.ts` reads the live entries for the balance checks, which run `memberBalances` from `core/balance.ts`. The routes are thin handlers in `server/routes/groups.ts` and `server/routes/members.ts`, both mounted at `/groups` behind `withUser`. Every write answers the group as `GET /groups` lists it, and a write whose effect already holds answers it as it is, so retries are safe.

**Spec:** `docs/specs/groups.md` (rules and API), `docs/specs/data-model.md`, `docs/specs/balances.md`, `docs/specs/invitations.md` (friends, names), `docs/specs/offline-sync.md` (the per-group `seq`), ADR-0012, ADR-0013, ADR-0014.

## Choices where the docs are open

- The maker's name comes from the server (their nickname, else their account), so the body of a new group is `me: { id }`; groups.md says `me: { id, name }` and is fixed. A friend added to a group is named the same way.
- The group's cursor is `MAX(seq)` of its entries, as `data-model.md` says for the upsert; there is no counter column on the group. `left_seq` takes it inside the update that sets `left_at`.
- Names of groups and of members: trimmed, 1 to 40, with something visible in them, the nickname's check (`isVisibleText`, moved to `core/text.ts`).
- Errors: `403 not-owner` for what only the owner may do; `409 direct` for what a friend can't do (a third member, removing, leaving, merging, handing over); `409 owner` when the owner leaves; `409 already-member` for a user who has a member row in the group, left or not (the unique index), so a user who left can't be added back; `409 not-a-user`, `not-placeholder`, `into-itself` for the merge and the hand over; `422 unknown-member`, `member-left` and `unknown-friend` for a member or friend the body names; `404 unknown-member` for a member the path names; `409 too-many-groups`, `too-many-friends`, `too-many-members` for the limits. groups.md lists them.
- The limit of 30 open groups also holds for a friend added to a group.
- The members of a new group are a millisecond apart, so the group lists them in the order they were sent (the maker first).
- A friend's other member is shown by their live nickname when they have one (invitations.md); in a group the stored name holds.
- Deleting is allowed with a balance when no member but the caller is a user who hasn't left.
- `closed` is `left` when the caller left, even if the group was later deleted, since their read stops at `left_seq`.

## Tasks

### Task 1: The schemas of groups and members in core

- Create `core/shared-group.ts`, `core/shared-group.test.ts`. Modify `core/text.ts`, `core/text.test.ts`, `core/profile.ts` (use `isVisibleText`), `docs/specs/groups.md` (names, `me: { id }`).
- Produces: `GROUP_KINDS`, `MAX_OPEN_GROUPS = 30`, `MAX_FRIENDS = 100`, `MAX_GROUP_MEMBERS = 30`, `SHARED_NAME_MAX_LENGTH = 40`; `groupIdSchema`, `memberIdSchema`, `sharedNameSchema`, `newGroupSchema`, `groupChangeSchema`, `groupWriteSchema`, `memberWriteSchema`, `mergeSchema`, `ownerSchema`, `mySwitchesSchema`; types `GroupKind`, `MemberRole`, `GroupClosed`, `NewGroup`, `GroupChange`, `MemberWrite`, `GroupMember extends SharedMember { name; role; claimed; leftAt }`, `SharedGroup`. `isVisibleText(text: string): boolean`.
- Tests: a group and a friend parse (a friend's name null, ids kept, names trimmed); a change parses; a write with `kind` is a new group or nothing (a bad new group is not read as a change); names empty, of spaces, invisible, of 41, not a string; ids not UUIDs, repeated; a friend with a name or with 0 or 2 others; a group of 31; member writes by name, by friend with and without `replaces`; switches; `isVisibleText`.
- Commit: `feat: add the schemas of groups and members to core`

### Task 2: The tables and the routes of a group

- Create `db/migrations/0011_shared_groups.sql`, `server/db/groups.ts`, `server/routes/groups.ts`, `server/routes/groups.test.ts`, `server/test/groups.ts`. Modify `server/app.ts`, `server/test/apply-migrations.ts`, `server/test/session.ts` (`signIn(email, name)`).
- Produces: `readGroup(db, userId, groupId): Promise<GroupState | null>`, `listGroups(db, userId): Promise<SharedGroup[]>`, `toSharedGroup(state): SharedGroup`, `closedFor(state)`, `manages(state)`, `countOpenGroups(db, userId, kind)`, `createGroup(db, userId, groupId, input): Promise<'created' | 'id-taken'>`, `changeGroup(db, groupId, change)`; `GET /groups`, `PUT /groups/:groupId`.
- Tests: 401 without a session; empty at first; a group made with the caller as owner named after the nickname, else the account, the others as placeholders in the order sent; a friend; repeating the make changes nothing; `409 id-taken` for a group of somebody else and for a member id in use, which stay as they were; the shapes refused; 30 open groups and 100 friends, each apart; the owner renames and switches simplified debts; a member who isn't the owner can't (`403`); either side of a friend can, and a friend keeps no name; a stranger gets the same `404` as a group that doesn't exist, on a write too, and the group is untouched; a stranger's groups aren't listed; no answer holds a user id or an email; a name is kept as it was when the group was made, and a friend shows the other's live nickname.
- Commit: `feat: add the groups tables and the routes to make and change a group`

### Task 3: Adding people

- Create `server/db/members.ts`, `server/routes/members.ts`, `server/routes/members.test.ts`. Modify `server/app.ts`.
- Produces: `addPlaceholder`, `renameMember`, `findFriend(db, userId, friendId): Promise<{ userId: string | null } | null>`, `addFriend(db, input)`; `PUT /groups/:groupId/members/:memberId`.
- Tests: any member adds a dummy; 30 members (those who left don't count, task 4); `409 id-taken` for a member id of another group; the owner renames anybody, a user renames themselves, a member can't rename another (`403`); repeating a write changes nothing; a friend refuses a third member (`409 direct`) and either side renames the other; adding a real friend makes them a member at once, named after them, and the group is in their list; refused when the caller isn't in that friend (`422 unknown-friend`, also for a deleted friend), the friend is a dummy (`409 not-a-user`) or already in the group (`409 already-member`), and over the friend's 30 open groups; `replaces` merges the dummy into the friend in one write (the dummy kept with `mergedInto` and `leftAt`), refused for a user (`409 not-placeholder`), an unknown member or one who left (`422`), and allowed at 30 members.
- Commit: `feat: add the routes to add and rename the people of a group`

### Task 4: Leaving, removing and deleting, and closed groups

- Create `server/db/entries.ts`. Modify `server/db/groups.ts`, `server/db/members.ts`, `server/routes/groups.ts`, `server/routes/members.ts` and their tests, `server/test/groups.ts` (seeding entries).
- Produces: `listLiveEntries(db, groupId): Promise<SharedEntry[]>`, `deleteGroup(db, groupId)`, `leaveGroup(db, memberId)`; `DELETE /groups/:groupId`, `DELETE /groups/:groupId/members/:memberId`; `409 closed` on every write.
- Tests: a member leaves when settled (row kept, `leftAt`, `left_seq` the group's cursor, the group closed `left` for them and still listed); refused with a balance (`409 unsettled`), deleted entries not counted, a balance merged into the member counted; the owner can't leave (`409 owner`); the owner removes a member or a dummy when settled; a member can't remove another (`403`); a friend can't be left or removed (`409 direct`); the owner deletes a settled group (closed `deleted`, rows kept), refused with a balance while another user is in it, allowed with a balance when the rest are dummies; a member can't delete (`403`); either side deletes a friend; repeating a leave or a delete answers the group; every write to a deleted group, and of a member who left, answers `409 closed`; a closed group doesn't count toward 30 open groups, 100 friends or 30 members.
- Commit: `feat: add leaving, removing and deleting a group, refused while unsettled`

### Task 5: Merging, handing over and the switches of a person

- Modify `server/db/members.ts`, `server/db/groups.ts`, `server/routes/members.ts`, `server/routes/groups.ts` and their tests.
- Produces: `mergeMember(db, memberId, into)`, `handOver(db, groupId, from, to)`, `saveMySwitches(db, memberId, switches)`; `POST /groups/:groupId/members/:memberId/merge`, `POST /groups/:groupId/owner`, `PUT /groups/:groupId/me`.
- Tests: the owner merges a dummy into a user (kept with `mergedInto` and `leftAt`, its balance moves); refused into a dummy (`409 not-a-user`), into itself (`409 into-itself`), of a user (`409 not-placeholder`), into a member who left or unknown (`422`), by a member (`403`), in a friend (`409 direct`), on a closed group; repeating it answers the group; the owner hands over to a user, who can then do what the owner does and the old owner can leave; refused to a dummy, to a member who left, by a member, in a friend; `showInExpenses` per member; `archived` only on a closed group (`409 not-closed`), deleted or left, and back; a stranger gets `404` on all three.
- Commit: `feat: add merging a dummy, handing a group over and the switches of a person`

### Task 6: Close part A

- Rewrite item 22 of `TODO.md` to say what part A built and what part B does; delete this plan; sync `groups.md`, `data-model.md` and `AGENTS.md`.
- Commit: `docs: close part A of the groups on the server`

## Review Focus

- The limits and the balance checks read and then write, not in one statement: two writes at the same moment can pass a limit by one, and an entry another device has not synced can leave a balance on someone who left (the spec accepts the second).
- A member who left still sees the current list of members (later names and renames); only the entries are cut at `left_seq` (part B).
- A name taken from a Google account isn't capped at 40 characters.
- A unique constraint failing on insert is read as `id-taken`; the checks before it make `already-member` the only other one, and only in a race.
- `toSharedGroup` picks every field by hand, so a user id can't slip into an answer; a new field must be added there.
- Nothing in part A puts a second user in a friend, so "never the same friend twice" is checked where it can happen, when an invitation is accepted (item 26).
