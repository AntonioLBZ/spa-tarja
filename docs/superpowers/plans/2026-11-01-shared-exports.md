# Plan: shared expenses in your own lists, second half (TODO item 27b)

Specs: `export.md`, `shared-expenses.md`, `groups.md`, `expense-counting.md`, `offline-sync.md`, `categories.md`,
`settings.md`, ADR-0012, ADR-0013. Choices where the specs are open, written into the spec in the task that needs them:

- **The JSON `groups`** follows `export.md`: every group the device holds, closed and archived ones and those whose
  switch Show in my expenses is off included. Each is built field by field, never spread, so nothing a ledger carries
  beyond the stored fields (a pending write carries its `groupId`) and no user id can reach the file. The members are
  `id`, `name`, `role`, `claimed`, `leftAt` and `mergedInto`, with no email or user id; the entries are the stored fields
  with `createdBy` and `updatedBy` (members, never users), the shares in cents, deleted ones left out, ordered by day,
  `createdAt` and id. The groups keep the order the server lists them (when they were made). A group whose expenses have
  not reached the device is left out: an empty entry list would claim it has none.
- **The CSV** always has the last column, group, empty for an expense of one's own, so the file keeps one shape. A
  shared row (`SharedExpenseRow`) is read through `row.shared`: the amount is the total, the payment the payer's card or
  "Now", your part always filled, the group the name the screens give it (`useGroupTitles`).
- **The rows** come from the ledgers the page already mounts for the JSON (`useLedgers`, through `sharedRowsOf`), so one
  set of queries feeds both files, and the switch of each group is applied by the same core function that feeds the
  lists.
- **Waiting.** While the groups, or the expenses of one of them, are loading for the first time, both buttons are off and
  a `Notice` with `role="status"` says what is awaited. Once it is answered, or failed, or paused offline, the buttons
  are on and the files hold what the device has; a group whose expenses cannot be had is named by a `Notice` saying it
  is left out. A device that never heard of its groups says nothing, as for its expenses.

## Tasks

1. **The sync seeds the cache of expenses.** `src/lib/offline/sync.ts` (`pushOutbox`: a sent expense goes into the cache
   as `{ expenses: [kept], cursor: 0 }` when nothing was pulled yet, as `pushGroup` does). Test first in `sync.test.ts`:
   with nothing pulled and the pull failing, a sent expense stays in the cache and the outbox is empty; a successful
   sync is unchanged (the existing tests). `offline-sync.md`.
2. **The suggestion reads your expenses.** `use-suggest-category.ts` takes `useYourExpenses`. Test first in
   `expenses.test.tsx`: a description used in a shared expense suggests the category of that row; a group whose switch is
   off suggests nothing. `categories.md`.
3. **The groups in the files.** `core/export.ts`: `BackupData.groups: readonly BackupLedger[]`
   (`{ group: SharedGroup; entries: readonly LedgerEntry[] }`), `Backup.groups: BackupGroup[]`, `CsvLabels.groupName(groupId)`
   and ten columns; `expensesCsv` reads a `SharedExpenseRow` through `isSharedRow`; `buildBackup` leaves shared rows out
   of `expenses`. `src/features/export/use-export-groups.ts` (`useExportGroups(): { ledgers, titles }`, every group with
   its entries on the device), `your-data.tsx` passing them, `columns.group` in `en` and `es`. Tests first in
   `core/export.test.ts` and `your-data.test.tsx` (`open()` waits for the groups too): a shared row in the CSV and never in
   `expenses`; the amount, the payment, the charge date and your part of a row of another payer, of a credit card and of
   a restaurant card; a settlement is not a row; a group with the switch off, a closed one, a friend, a member who left,
   a merged dummy, an empty group; names with commas, quotes, newlines and a leading `=`; the order; the file names; no
   email or user id anywhere in either file; offline. `export.md`.
4. **Waiting.** `useExportGroups` also says `loading` and `missing`; `your-data.tsx` turns the buttons off while
   `loading` and shows the two notices; copy in `en` and `es`. Tests first: the buttons wait and the notice says so while
   the groups load; a group whose expenses cannot be had is left out and said; a device that never heard of its groups
   says nothing. `export.md`, `settings.md`, `shared-expenses.md`, `AGENTS.md`; this plan and item 27 of `TODO.md`
   deleted.

## Review Focus

- A shared row reaching the JSON `expenses`: the page must pass `useExpenses`, and `buildBackup` drops one anyway.
- A group leaking a user id or an email: the fake groups carry none, so the test must plant them in the data the file
  is built from and look for them in the text.
- A pending entry (written offline, not synced) in the JSON group: it carries `groupId`, and its `createdBy` and
  `updatedBy` are made up by `withPending`.
- The buttons stuck off: a group whose first sync never answers (a hanging request) keeps `loading` true; a failure or
  a paused query must always turn it off.
- A friend named by the other person: the CSV group column is the name the screens give, "Deleted user" and numbering
  for equal names included.
- The seeding of a personal expense with a cursor of 0: the pull that follows must start from the beginning and must
  not drop the seeded row.
