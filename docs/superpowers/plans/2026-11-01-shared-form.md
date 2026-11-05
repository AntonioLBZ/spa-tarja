# Sharing an Expense, First Half (item 25a) Implementation Plan

**Goal:** The write side of a shared expense: the add form split into its head (amount, description, category, day) and its two tails, Just me (today's fields) and Shared (With, Paid by, Split, the people, How you paid), at home and on the screen of a group, saving an entry of kind `expense` through `useEntryActions`. Not here (item 25b): the ledger of a group, Edit, Duplicate and Delete with Undo of shared entries, the filter Shared with, the notice of refused writes.

**Architecture:** `ExpenseForm` keeps the head, the choice For and the submit; the payment and its charge date are its state too, since both tails show them (the Shared one only while the payer is the person). `PersonalTail` (`src/features/expenses/personal-tail.tsx`) takes today's fields out of the form unchanged; `PaymentFields` draws the payment `Select` and the charge date for both. The Shared tail is a hook and a component in `src/features/groups/shared-tail.tsx`: `useSharedTail` holds the draft (the group, the payer, the mode, who is out, what was typed) and works the shares out in cents with `core/split.ts`; the form calls both hooks, so switching For keeps what was typed in the other tail. A new entry is built in one place (`newEntry`, used by Settle up too). A group screen mounts the same form with its group fixed.

**Spec:** `docs/specs/shared-expenses.md`, `expenses.md`, `groups.md`, `balances.md`, `frontend.md`, `offline-sync.md`, `design-system/DESIGN.md`, ADR-0012, ADR-0013.

## Choices where the docs are open

- How you paid is left out, not only off, while the payer is somebody else ("only when Paid by is you"); the entry built then is paid now whatever the payment state holds.
- With starts on the group used last (`tarja:shared-with`), else on the first of the list: the groups, then the friends, as the Groups tab lists them.
- What is typed in the percentages or the amounts holds for the members who are in (and, for amounts, the total) it was typed for, as the payments of a plan do; otherwise they start again from the even split.
- The people are a fieldset whose legend is "Who's in"; each share field is named after the person.
- For is left out while editing a personal expense: an edit doesn't turn it into a shared one.
- A shared expense brings no budget warning until item 27 counts it in the budgets.
- Add in Shared is off until the expense can be saved, as the spec says; Just me keeps saying what is wrong on Add, as today.
- On a group screen the form is there whenever the group is open, also while its entries haven't reached the device.

## Tasks

### Task 1: One builder for new entries

- Create `src/features/groups/new-entry.ts` (+ test). Modify `settle-up.tsx`.
- Produces: `newEntry(group: SharedGroup, fields: EntryFields): SharedEntry` (a new id, the group's currency, made and written now, not deleted).
- Tests: the entry has a new id each time, the group's currency, `createdAt` = `updatedAt` = now and no `deletedAt`, and keeps the fields given; Settle up's tests stay green.
- Commit: `refactor: build a new entry of a group in one place`

### Task 2: The head, For and the Shared tail, split equally

- Create `src/features/expenses/personal-tail.tsx`, `payment-fields.tsx`, `src/features/groups/shared-tail.tsx` (+ `.css`), `shared-with.ts`, `src/features/groups/share-expense.test.tsx`. Modify `expense-form.tsx`, `icon-paths.ts` (`person`), locales.
- Produces: `PersonalTail`, `usePersonalTail(start, totalCents, date, payment)`, `PaymentFields`, `usePayment(start, date)`, `SharedTail`, `useSharedTail(group | undefined, totalCents, payment)`, `readSharedWith()`, `rememberSharedWith(groupId)`.
- Tests: For starts on Just me; Shared lists the open groups and friends only, each with its name, and starts on the one used last; Paid by starts on you; €10.00 among three is 3.34, 3.33 and 3.33 in the group's order, and so it is saved; someone left out has no share and shows nothing; nobody in keeps Add off and says so; Add saves an `expense` entry in the group outbox, offline too, then empties the form and puts For back on Just me; a double tap saves once; a device that can't keep it keeps the form and says so; switching For keeps the head and what was typed in the other tail; without any open group, a hint.
- Commit: `feat: share an expense from the add form`

### Task 3: Split by percent or by amount

- Modify `shared-tail.tsx` (+ `.css`), locales, the test.
- Tests: Percent starts at 33.34, 33.33 and 33.33 and saves cents that add up to the amount; a percentage left or over is said and keeps Add off, in `es` with a comma too; Amounts starts from the equal split, says what is unassigned or over and keeps Add off until it adds up; changing the mode keeps who is in; a field that isn't a number is said; the mode is stored as `split`.
- Commit: `feat: split a shared expense by percent or by amount`

### Task 4: How you paid, and the default categories

- Modify `shared-tail.tsx`, `expense-form.tsx`, locales, the test.
- Tests: How you paid is there while you pay, with its hint, and a card saves `payment` and `chargeDate`; choosing somebody else as the payer leaves it out and puts it back to Now; a card needs you in the split; the charge date is checked as for a personal expense; Shared offers the default categories only, replaces a custom one by the suggestion with its hint, and the suggestion still works.
- Commit: `feat: let the payer of a shared expense say how they paid`

### Task 5: The form on the screen of a group

- Modify `group-screen.tsx` (+ `.css`), `group-screen.test.tsx` or the shared test.
- Tests: the screen has the form collapsed under "Add an expense", without For or With; adding updates the balances at once, offline too; a closed group, deleted or left, has no form; a group closed as Add is pressed says so and keeps nothing; an answer lost on the way is sent again once and the entry exists once.
- Commit: `feat: add a shared expense on the screen of a group`

### Task 6: New person…

- Modify `shared-tail.tsx`, locales, the test.
- Tests: the last option of With asks for a name, makes a friend and chooses it; offline it is off with a hint and the groups on the device still work; without any group, the hint and the form.
- Commit: `feat: make a friend from the add form`

### Task 7: Close

- Delete this plan; rewrite item 25 of `TODO.md` to what 25b still has to do; sync the specs with the choices above.
- Commit: `docs: close the first half of sharing an expense`

## Review Focus

- The personal form after the split: what Just me saved before it saves the same (the long `expenses.test.tsx` guards most of it).
- The payment state both tails share: a card chosen in Just me never reaches an entry whose payer is somebody else.
- A member who leaves or is merged while the form is open drops out of the people and of Paid by; a group that closes drops out of With.
- Cents that add up in every mode, and percentages read with the decimal separator of each locale.
- The rows of the people at 320 px in both languages (no browser was used).
