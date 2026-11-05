# Plan: shared expenses in your own lists, first half (TODO item 27a)

Specs: `expense-counting.md`, `expense-list.md`, `summary.md`, `charts.md`, `budgets.md`, `shared-expenses.md`,
`groups.md`, `offline-sync.md`, ADR-0007, ADR-0009, ADR-0012, ADR-0013. The rows come from `sharedExpenseRows`
(`core/shared-expense.ts`) and go through the counting helpers unchanged; nothing is stored. Choices where the specs are
open, written into the spec in the task that needs them:

- **Which ledgers your expenses sync.** The screens that show your own expenses (home, the summary, the charts, the
  budgets) and the add form wherever it is (its budget warning counts them) mount the sync of the groups whose Show in
  my expenses is on, and of any group with a write waiting, through the existing `groupEntriesQuery`, so the triggers
  are those of the personal sync (open, focus, reconnect, a save, every 30 s while a write waits). A group whose switch
  is off and that has nothing waiting is not asked for there (`offline-sync.md`).
- **A shared row of a closed group** has nothing to open in the list, as in its ledger: the entry is read-only.
- **A claimed dummy.** Taking the place of a dummy (an invitation accepted, a friend added in its place, a merge) takes
  its entries: their parts count in the person's expenses on the days they were made, past months included, while the
  switch is on (on by default); no budget warning comes for them (`shared-expenses.md`).

## Tasks

1. **The counting of your part, pinned.** `core/shared-expense.test.ts` only (no code change: the helpers need none).
   Tests: through `summarizeMonth`, `spentFor`/`budgetUses`, `budgetWarning`, `spendingTotal` and `buildList`: another
   payer's credit card counts in the month made, your credit card in the month charged (a month boundary: made 31 Oct,
   charged 2 Nov; the list on 31 Oct); your restaurant card as income of the charge month; you out of the split; a
   settlement; the switch off; a payer who left; you who left (the rows stay); a merged dummy.
2. **The ledgers of your expenses, synced where they show.** `src/features/groups/use-ledgers.ts`
   (`useExpenseLedgers(): { ledgers: Ledger[]; pendingIds: Set<string> }`, the groups with the switch on or a write
   waiting); `use-shared-expense-rows.ts` (`sharedRowsOf(group: SharedGroup, entries: readonly SharedEntry[]):
SharedExpenseRow[]`, `useSharedExpenseRows(): { rows; pendingIds; sourceOf(rowId): SharedRowSource | undefined }`,
   `interface SharedRowSource { group; entry }`); `src/features/expenses/use-your-expenses.ts` (`useYourExpenses()`,
   the shape of `useExpenses` with the rows and their pending ids on top, plus `sourceOf`), read by `use-expense-list`
   and `use-budget-warning`; `offline-sync.md`. Tests (`share-expense.test.tsx`, `use-shared-expense-rows.test.tsx`):
   a shared expense added at home offline is sent on reconnect with no screen of groups opened; a write to a group
   whose switch is off is sent from home, and that group is not pulled otherwise; a dropped connection is retried every
   30 s from home; `group-screen.test.tsx` adjusted: a group screen asks for its own ledger and those in your expenses.
3. **The summary, the charts and the budgets count your part.** `summary.tsx`, `charts.tsx`, `budget-bars.tsx` read
   `useYourExpenses`; `expense-form.tsx` warns after a shared add or duplicate with `sharedRowsOf` (the tail's
   `entryOf` answers its group). Tests: summary (your part spent, a card payer's month, card income, a settlement and a
   switched-off group not counted), charts (the total holds your part on the day made), budget bars (the use holds your
   part), warnings (a shared add crosses a limit, a duplicate too, a group with the switch off doesn't warn, an edit
   doesn't), the JSON export keeps them out of `expenses`.
4. **The rows in the list.** `core/expense-list.ts` (`ListContext.groupNameOf: (groupId: string) => string`, read by
   the search for a shared row); `use-group-options.tsx` (`useGroupTitles(groups): Map<string, string>`);
   `expense-row.tsx` (`source?: SharedRowSource`: the group, who paid and the total when it isn't your part, Edit off
   for an entry that names somebody who left, nothing to open in a closed group); `shared-row-details.tsx`;
   `names-someone-who-left.ts` (moved out of `ledger-row.tsx`); copy in `en`/`es`; `expense-list.md`. Tests
   (`core/expense-list.test.ts`, `src/features/expenses/shared-rows.test.tsx`): details in words, pending mark,
   subtotal by the day made, search by group and by friend, Shared with keeps a group's rows and Just me drops them,
   Paid with finds a card payer's row, a closed group's row doesn't open, a row naming someone who left can't be edited,
   a switched-off group gives no row.
5. **Edit, Duplicate and Delete from the list.** `add-form-state.tsx` (`editingEntry`, `copyingEntry`,
   `startEditEntry(source)`, `startCopyEntry(source)`), `add-expense.tsx` (passes `group`, `editingEntry`,
   `copyingEntry`), `expense-list.tsx` (delete through `useEntryActions` with the toast naming the group and Undo, a
   refusal said under the title). Tests: Edit opens the shared form fixed to the group and Save writes the same id later;
   Duplicate adds a new entry there and the row comes; Delete fades the row, the toast says the group, Undo brings it
   back with the focus; a delete refused (the group closed meanwhile) is said; deleting the entry being edited ends the
   edit.
6. **Docs and close.** `shared-expenses.md` (the claimed dummy), `TODO.md` (item 27 keeps only 27b), this plan deleted.

## Review Focus

- A shared row reaching a personal path: `useExpenses` must stay personal (exports, the suggestion and the personal
  sync read it); only `useYourExpenses` adds the rows.
- A request storm: every screen calling `useYourExpenses` mounts the same queries; Query dedupes them by key and the
  60 s `staleTime` holds, but a group appearing and disappearing from the chosen set (a write waiting) must not loop.
- The budget warning's "before" is read in the render before the save; a shared add must compare the month without
  the new entry.
- Focus after deleting a shared row next to a closed group's row (no toggle, the `li` takes it).
- Ids of entries and personal expenses never collide (both UUIDs), so one `pendingIds` set is safe.
