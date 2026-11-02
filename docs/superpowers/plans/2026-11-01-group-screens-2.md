# The Screens of Groups, Second Half (item 24b) Implementation Plan

**Goal:** What is left of the screens of groups and friends: settling up from the balances, leaving and deleting a group (removing a friend), merging a dummy and making someone owner, adding a friend, and adding friends to a group (in New group and under Add a person, as a new member or in place of a dummy). Not here: invitations (item 26), the add form and the ledger (item 25), simplified debts (item 28), deleting the account (item 29).

**Architecture:** Every change goes through `useGroupActions` (needs a connection) or `useEntryActions` (the outbox, so a settlement works offline), and every refusal through `failureOf` and `useFailureWords`, which learn the codes these actions can meet. `GroupBalances` becomes presentational with an `onSettle` per line; the settle up form and its state live in the group screen above it. `PersonRow` hands the focus between its steps through one small hook instead of a ref per button. `NewGroup` keeps a member id for every person in its list, dummies and friends, and after `createGroup` answers it puts the group right against the list (adds who is missing, renames, removes who was taken out), which is also what fixes a list changed after a lost answer.

**Spec:** `docs/specs/groups.md`, `balances.md`, `shared-expenses.md`, `frontend.md`, `design-system/DESIGN.md`, ADR-0012, ADR-0014.

## Choices where the docs are open

- Leave and Delete ask in a panel that replaces the `danger` button, as `groups.md` says (and as People and the categories do), not in a `Dialog`: `DESIGN.md` keeps `Dialog` for what has nothing to do with the screen under it, and the spec puts the focus on Cancel, which a `Dialog` doesn't do.
- A friend's settings end with **Remove friend**, the delete of a friend group, worded for a friend.
- The `Select` of friends under Add a person lists every open friend who is a real person: a member carries no user, so the device can't tell which friend is in the group already; the server's `already-member` says so in words. `groups.md` follows.
- The settlement form has no note: the spec lists From, To, the amount and the day. Its text is empty.
- "After this, you're settled" names the other person ("you're settled with Bruno"), since you may still owe others; `balances.md` follows.
- Delete asks only when the device sees every balance at zero, or no user but the person in the group who hasn't left (a member with an empty name deleted their account and is no user). A ledger never pulled asks, and the server decides.

## Tasks

### Task 1: Settle up

- Modify `src/features/groups/group-balances.tsx` (+ `.css`), `group-screen.tsx`, `design-system/stories/features/group-balances.stories.tsx`, locales, `balances.md`. Create `src/features/groups/settle-up.tsx` (+ `.css`, `.test.tsx`).
- Produces: `GroupBalances { group; entries; onSettle?: (debt: Debt) => void }` (a ghost Settle up on each line between two people who haven't left, none without `onSettle`); `useSettleUp(group, entries)` → `{ open, draft, setDraft, setOpen, take(debt), asked }`; `SettleUp { group; entries; form }`.
- Tests: a line's Settle up fills From, To and the amount and puts the focus on the amount; the toggle starts on you and the one you owe most with an empty amount and the debt as a hint; Save is off while the amount is empty, zero or not a number, or From is To (which says so); the hint says what follows; Save writes one `settlement` through the outbox, offline too, and the lines change at once; a closed group and a line naming someone who left have no Settle up; the Spanish names hold the visible words.
- Commit: `feat: settle up from the balances of a group`

### Task 2: Leave and Delete

- Create `src/features/groups/close-group.tsx` (+ `.css`, `.test.tsx`), `may-delete.ts` (+ test). Modify `group-settings.tsx`, `group-failure.ts` (+ test), locales, `groups.md`.
- Produces: `mayDelete(group, entries): boolean`; `CloseGroup { ledger; disabled }` (Leave for a member, Delete for the owner, Remove friend for a friend); `GroupFailure` gains `ownerLeaves`.
- Tests: the panel asks with what happens and the focus on Cancel, Cancel gives it back; confirming leaves (or deletes) and opens Groups with the group among the closed ones; a balance that isn't zero says so with a link to settle up instead of asking, and so does the server's `unsettled`; `unsynced`, `offline` and `owner` are said in words; the owner has no Leave and a member no Delete; a friend has Remove friend; a closed group has none; offline they are off.
- Commit: `feat: leave or delete a group`

### Task 3: Merge and Make owner

- Modify `src/features/groups/person-row.tsx` (+ `.css`), `group-people.tsx`, `group-people.test.tsx`, `group-failure.ts`, `src/components/select/select.tsx` (+ test: `ref`), locales. Create `src/features/groups/use-step-focus.ts`.
- Produces: `useStepFocus(step, first)` → `{ opener(step), start }` ref callbacks; `Select` takes `ref` to its field; `GroupFailure` gains `memberGone`, `notAUser`, `notPlaceholder`.
- Tests: the owner merges a dummy into a member who is a user, picked in a `Select`, after reading it can't be undone; the row leaves the list, its balance goes to the target and the focus to the label; Make owner asks with the focus on Cancel and hands over, the row then says Owner and the focus goes to the label; neither is offered to a member who isn't the owner, Merge not on a user, Make owner not on a dummy nor on yourself; refusals in words; offline off; Spanish names hold the visible words.
- Commit: `feat: merge a dummy and make someone owner`

### Task 4: Add a friend, and the totals that wait

- Create `src/features/groups/add-friend.tsx` (+ `.css`). Modify `groups.tsx`, `groups.test.tsx`, `group-failure.ts`, locales.
- Produces: `AddFriend { disabled }`; `GroupFailure` gains `tooManyFriends`.
- Tests: Add a friend makes a friend group with that name and opens it; the same ids after a failure, and a name changed after a lost answer is put right; a name with nothing that shows is refused before sending; `too-many-friends` in words; offline off; the totals say why they wait when an open group's expenses can't be loaded.
- Commit: `feat: add a friend`

### Task 5: Friends in a group

- Create `src/features/groups/use-real-friends.ts`. Modify `new-group.tsx`, `group-people.tsx` (+ `.css`), `groups.test.tsx`, `group-people.test.tsx`, `group-failure.ts`, `use-group-actions.ts`, `src/components/select/select.tsx` (+ test, story: `disabled`), locales, `groups.md`, `DESIGN.md`.
- Produces: `useRealFriends(): RealFriend[]` (`{ id; name }`, open friends whose other member is claimed); `Select` takes `disabled`; `GroupFailure` gains `alreadyMember`, `unknownFriend`, `friendTooManyGroups`.
- Tests: New group lists real friends in a `Select`, adds them to the list with the dummies and, once the group is made, adds each friend; a refused friend says why and a retry sends the same ids; a list changed after a lost answer ends as the list is; Add a person adds a friend as a new member, and the owner of a group with dummies can put them in place of one (the dummy leaves the list); a member who isn't the owner gets no choice; `already-member` and the friend's `too-many-groups` in words; offline off.
- Commit: `feat: add friends to a group`

### Task 6: Close

- Delete this plan; delete item 24 from `TODO.md` and update the header sentence and item 25 if needed; check `groups.md`, `balances.md`, `DESIGN.md` and `AGENTS.md` are in sync.
- Commit: `docs: close the screens of groups and friends`

## Review Focus

- The local checks before Leave, Delete and Remove read the device's entries, which may be behind; the server's `409 unsettled` still decides and is shown as the same panel.
- A settlement saved while the group closes on another device goes to the outbox and is refused there for good (`409 closed`), which the notice of item 25 will show.
- Reconciling New group after `createGroup` makes several calls in a row; one that fails leaves the group made and the form open with the same ids, so pressing again finishes it, but the person may also leave the screen with the group half done.
- The friend `Select` can't leave out friends already in the group; the server refuses them.
- `useStepFocus` relies on the step's start control being mounted when the effect runs.
