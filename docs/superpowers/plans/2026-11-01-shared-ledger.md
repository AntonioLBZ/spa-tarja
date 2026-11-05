# Sharing an Expense, Second Half (item 25b) Implementation Plan

**Goal:** The read side and the changes of a shared entry: the ledger of a group on its screen, Edit, Duplicate and Delete with Undo of its entries (settlements included), the notice of the writes the server refused for good, and the filter Shared with of the expense list. Not here (item 27): the shared rows in the personal list, the summary, the charts, the budgets and the exports.

**Architecture:** `GroupLedger` (`src/features/groups/group-ledger.tsx`) draws the entries of a `Ledger` by day on `Sheet`s with `LedgerRow`s, and owns Delete, Undo, the fade-out and the focus, like `ExpenseList`. Whether the add form of a group is open, and what it edits or copies, is `useLedgerForm` in `GroupView`, next to `useSettleUp`, which learns to edit a settlement. `ExpenseForm` takes an entry to edit or copy; `useSharedTail` starts from it (`draftOfEntry`) and keeps its saved cents while the split isn't touched. `EntryRefusals` shows `useGroupOutbox().getState().rejected`, one `Notice` with Dismiss each (`dismissRejection` on the outbox). The filter is `sharedWith` in `core/expense-list.ts`, read through `isSharedRow` (`core/shared-expense.ts`).

**Spec:** `docs/specs/shared-expenses.md`, `groups.md`, `expense-list.md`, `expenses.md`, `offline-sync.md`, `balances.md`, `design-system/DESIGN.md`, ADR-0010, ADR-0012, ADR-0013.

## Choices where the docs are open

- The refusals of the group outbox live in memory and don't survive a reload, as those of the expenses; each says the entry, the group and why, and has its own Dismiss. They show at home under the sync status (all of them) and on the screen of their group (its own), under the title.
- The ledger is titled "Expenses" (`h2`, the place the focus goes when no row is left); its day sheets are `h3`. With no entry, a quiet `Notice`. A day of settlements only has no foot: nothing was spent.
- "Added by" while the entry was never edited (`updatedAt` = `createdAt`), "Edited by" after; only when the last writer isn't you.
- The device doesn't offer Edit for an entry that names somebody who left (paid, or has a share, a merged placeholder read as its target): a quiet notice says to delete it and add it again. The server still allows the edits that keep that person as they were.
- An edit by somebody who isn't the payer keeps the payer's card; a duplicate is paid now unless you paid.
- A settlement is edited in the Settle up form ("Edit the settlement", Save and Cancel); Save and Cancel close it and give the focus back to the row.
- Shared with lists Anyone, Just me and the groups and friends whose Show in my expenses is on, closed or not, the groups first.

## Tasks

### Task 1: The filter Shared with

- Modify `core/expense-list.ts` (+ test), `core/shared-expense.ts`, `src/features/expenses/expense-list-controls.tsx`, `expenses.test.tsx`, locales, `docs/specs/expense-list.md`.
- Produces: `ListFilters.sharedWith: string` (`''` anyone, `JUST_ME`, else a group id), `isSharedRow(expense): expense is SharedExpenseRow`.
- Tests: core: Just me drops shared rows, a group keeps only its rows, it counts as one filter and Clear drops it; front: the `Select` after Paid with lists Anyone, Just me and the groups with the switch on, groups first, and counts in Filters (n).
- Commit: `feat: filter the expense list by who it is shared with`

### Task 2: The notice of refused writes

- Modify `src/lib/offline/outbox.ts` (+ test). Create `src/features/groups/entry-refusals.tsx` (+ `.css`, + test). Modify `routes/index.tsx`, `group-screen.tsx`, locales, `docs/specs/offline-sync.md`, `shared-expenses.md`.
- Produces: `Outbox.dismissRejection(rejection)`, `EntryRefusals({ groupId? })`.
- Tests: dismissing one keeps the others; a refused add at home is said in words with the group and the reason, `clock-ahead` says to check the clock, each code has its words, Dismiss takes it away; the screen of a group shows only its own; a reload forgets them.
- Commit: `feat: say which writes to a group were refused and why`

### Task 3: The ledger

- Create `src/features/groups/group-ledger.tsx`, `ledger-row.tsx` (+ `.css`), `group-ledger.test.tsx`. Modify `group-screen.tsx`, locales.
- Produces: `GroupLedger`, `LedgerRow`.
- Tests: newest day first, the latest made first within a day, each day with the total of its expenses; a row says who paid, your part or "Not in this one", "Added by" or "Edited by" another member, "Not synced yet"; a settlement in words with its amount; deleted entries absent; empty state; Show more by 100; a closed or left group has rows with nothing to open.
- Commit: `feat: list the entries of a group on its screen`

### Task 4: Delete and Undo

- Modify `group-ledger.tsx`, `ledger-row.tsx`, `use-expense-list.ts` (the fade-out shared as `useFadeOut`), locales, the test.
- Tests: Delete asks nothing, writes a later deleted version, the toast names the entry and the group, Undo brings it back newer and focuses its row; the focus goes to the next row, else the one before, else the title; offline; a settlement too; an entry naming somebody who left can be deleted and undone; only the last delete is undone.
- Commit: `feat: delete an entry of a group with undo`

### Task 5: Edit and Duplicate a shared expense

- Create `src/features/groups/use-ledger-form.ts`. Modify `shared-tail.tsx`, `expense-form.tsx`, `group-screen.tsx`, `group-ledger.tsx`, `ledger-row.tsx`, locales, tests.
- Produces: `useSharedTail(group, totalCents, payment, source?: { entry, copy })`, `ExpenseForm` props `editingEntry` and `copyingEntry`, `useLedgerForm()`.
- Tests: Edit opens the form with the payer, the mode, who is in, the percentages and the amounts as saved, focus on the heading; Save keeps the id, `createdAt` and the cents when the split isn't touched, with a later `updatedAt`, and gives the focus back to the row; Cancel saves nothing; a half typed expense is replaced; Duplicate is a new entry of today with the same payer, mode and people; a non-payer's edit keeps the payer's card; Edit is off with its notice for an entry naming somebody who left; a refused edit puts the row back as the server kept it and says why; an edit whose answer was lost is sent again once.
- Commit: `feat: edit and duplicate a shared expense from the ledger`

### Task 6: Edit a settlement

- Modify `settle-up.tsx`, `group-screen.tsx`, `group-ledger.tsx`, locales, `settle-up.test.tsx` or the ledger test.
- Tests: Edit fills From, To, the amount and the day, under "Edit the settlement" with Cancel; Save keeps the id and `createdAt` with a later `updatedAt`, closes the form and focuses the row; the hint leaves out the settlement being edited; no Duplicate for a settlement.
- Commit: `feat: edit a settlement from the ledger`

### Task 7: Close

- A story for `LedgerRow` if it is cheap; sync `shared-expenses.md`, `groups.md`, `balances.md`, `offline-sync.md`, `expense-list.md`, `DESIGN.md`, `AGENTS.md`; delete this plan and item 25 of `TODO.md`, updating the header sentence.
- Commit: `docs: close sharing an expense`

## Review Focus

- A filter Shared with naming a group whose switch went off on another device while the list is open: the `Select` shows nothing chosen.
- An edit by a non-payer that moves the day past the payer's charge date: the server's `400` is the only check, said as a plain refusal.
- `createdBy` and `updatedBy` ride along in the outbox copy of a deleted or restored entry; the server and the ledger ignore them.
- Undo after the group closed meanwhile: refused on the device and said under the ledger title.
- The focus and the scroll into view on a real phone, the rows and the notices at 320 px in both languages.
