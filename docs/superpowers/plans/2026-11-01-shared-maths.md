# Shared Maths Implementation Plan

**Goal:** The pure maths of shared expenses in `core/`: the entry schema, the split, the balances and who owes whom, the simplified debts, and the rows of your part for your own lists. No route, SQL, component or copy.

**Architecture:** One valibot schema for an entry (`core/shared-entry.ts`) that the client and the Worker share. The split works in cents and puts the remainder deterministically (`core/split.ts`). The balances and the pairwise debts read every member id through `canonicalMember` (`core/shared-member.ts`), so a merged placeholder is its target. `core/simplify.ts` turns balances into payments. `core/shared-expense.ts` derives rows of the shape of `Expense`, so `core/counting.ts` and everything built on it need no change. The order of a group is the order of the members passed in (the server lists them by when they were added, then by id).

**Spec:** `docs/specs/shared-expenses.md` (the entry, splitting, the payment, in your own expenses), `docs/specs/balances.md`, `docs/specs/groups.md` (members, merging, Show in my expenses), `docs/specs/expense-counting.md` (shared expenses), `docs/specs/data-model.md` (`shared_entries`), `docs/adr/0012-shared-expenses.md`, `docs/adr/0014-people-in-groups.md`.

## Choices where the docs are open

- The schema checks the category's shape only, like the expense schema; whether it is a default one is `isDefaultCategoryId`, checked apart, so the Worker can still answer `400 unknown-category` as the spec says.
- `payment` left out is `direct`, `chargeDate` left out is none. A settlement is split `exact` (its one share is the amount). A `direct` entry has no charge date (there are no installments in a group), else `countedOn` would move a payer's row to it. The spec gains these lines.
- Percentages are hundredths of a percent (basis points, 0 to 10 000). Going to percentages starts from 100 % split evenly in hundredths (33.34, 33.33, 33.33), the remainder to the first ones; reopening an entry rounds each share over the amount the same way as the parts are rounded, so they add up to 100 and the form opens valid. The spec gains both.
- A member whose part comes to zero cents (an amount smaller than the people in, or a tiny percentage) is left out of the shares, as one at 0 % is: the schema refuses a share under one cent. The spec says so.
- Balances list every member that isn't merged, in the group's order, the left ones included, and after them any id the entries name that the members don't (a member added on another device before the groups refresh), so they always add up to zero.
- A share of the payer, once read through a merge, owes nobody: a placeholder merged into the member who paid for it adds nothing to who owes whom. The balances spec says so.
- The row of your part carries the group, who paid and the total; whether it waits to sync is read by its id, as for a personal expense (the spec is reworded).

## Tasks

### Task 1: The entry schema

- Create `core/shared-entry.ts`, `core/shared-entry.test.ts`. Modify `docs/specs/shared-expenses.md` (the entry).
- Produces: `SPLIT_MODES = ['equal', 'percent', 'exact']`; `sharedEntryInputSchema` (a `v.variant` on `kind` of an expense and a settlement, piped with the checks); `type Share = { memberId: string; cents: number }`; `type SplitMode`; `type SharedEntryInput` (the union, `payment` and `chargeDate` always present on the output); `type SharedEntry = SharedEntryInput & { id: string }`.
- Tests: accepts an expense, filling `payment: 'direct'` and `chargeDate: null`; accepts a settlement, filling `categoryId: null`, `split: 'exact'`; a card expense charged that day or later with the payer in; the payer left out of a direct one; rejects shares that don't add up (a cent short, a cent over), a share of 0, negative, fractional, a member twice, no shares, an amount of 0 or over the maximum, a member id that isn't a UUID, an unknown kind or split, an expense without a category, a settlement with a category, two shares, to oneself, paid by card, with a charge date, split `equal`, a card without a charge date or charged before, a direct one with a charge date, a card with the payer out, a text over 200.
- Commit: `feat: add the schema of a shared entry to core`

### Task 2: The split

- Create `core/split.ts`, `core/split.test.ts`, `core/test/random.ts` (a seeded generator for the property tests). Modify `docs/specs/shared-expenses.md` (splitting).
- Produces: `HUNDRED_PERCENT = 10_000`; `interface MemberPercent { memberId: string; basisPoints: number }`; `splitEqually(amountCents: number, memberIds: readonly string[]): Share[]`; `splitByPercent(amountCents: number, percents: readonly MemberPercent[]): Share[] | null`; `splitExactly(amountCents: number, parts: readonly Share[]): Share[] | null`; `unassignedCents(amountCents: number, parts: readonly Share[]): number`; `percentLeft(percents: readonly MemberPercent[]): number`; `equalPercents(memberIds: readonly string[]): MemberPercent[]`; `percentsOf(amountCents: number, shares: readonly Share[]): MemberPercent[]`. `seededRandom(seed: number): Random` with `int`, `pick`, `chance`, `shuffle`.
- Tests: examples of each mode (remainder to the first ones; to the biggest fractions, a tie to the first; 0 % left out; zero cents left out); null for percentages that don't add up or are out of range and amounts that don't add up; over many seeded inputs: the shares add up to the amount, each at least a cent, each member at most once and only those in, in the group's order, the same output twice, equal parts at most a cent apart, a percent part within a cent of the exact one, the output parses as an entry; `equalPercents` and `percentsOf` add up to 100 %, and `percentsOf` of an equal split is within a hundredth of the exact ratio.
- Commit: `feat: add the split of a shared expense to core`

### Task 3: Members, balances and who owes whom

- Create `core/shared-member.ts`, `core/shared-member.test.ts`, `core/balance.ts`, `core/balance.test.ts`. Modify `docs/specs/balances.md` (merged payer).
- Produces: `interface SharedMember { id: string; mergedInto: string | null }`; `canonicalMember(members: readonly SharedMember[], memberId: string): string`; `interface MemberBalance { memberId: string; cents: number }`; `interface Debt { from: string; to: string; cents: number }`; `memberBalances(entries: readonly SharedEntry[], members: readonly SharedMember[]): MemberBalance[]`; `pairwiseDebts(entries: readonly SharedEntry[], members: readonly SharedMember[]): Debt[]`.
- Tests: `canonicalMember` reads a placeholder as its target and anything else as itself; a dinner paid by one; balances add up to zero; deleted entries ignored; a member who left still listed; a settlement of the debt, of less and of more (turns it round, Ana owes Bruno 30, pays 50, Bruno owes Ana 20); a merge moves the placeholder's balance to the target and leaves the others; a payer merged with a share owes nobody; over many seeded groups: zero sum, each member's lines add up to their balance, deleted entries change nothing, a merge moves a balance and nothing else, no pair listed twice or at zero.
- Commit: `feat: add the balances of a group to core`

### Task 4: Simplified debts

- Create `core/simplify.ts`, `core/simplify.test.ts`.
- Produces: `simplifyDebts(balances: readonly MemberBalance[]): Debt[]`.
- Tests: the spec's rule on an example (most owing pays most owed the smaller amount); a tie goes to the first in the order; nothing for a settled group; over many seeded groups: applying the payments leaves every balance at zero, nobody both pays and receives, at most one payment fewer than the members with a balance, every payment at least a cent, the same output twice.
- Commit: `feat: add the simplified debts to core`

### Task 5: Your part in your own expenses

- Create `core/shared-expense.ts`, `core/shared-expense.test.ts`. Modify `docs/specs/shared-expenses.md` (in your own expenses).
- Produces: `interface SharedLedger { groupId: string; me: string; showInExpenses: boolean; members: readonly SharedMember[]; entries: readonly SharedEntry[] }`; `interface SharedSource { groupId: string; paidBy: string; totalCents: number }`; `interface SharedExpenseRow extends Expense { shared: SharedSource }`; `yourPart(entry: SharedEntry, me: string, members: readonly SharedMember[]): number`; `sharedExpenseRows(ledgers: readonly SharedLedger[]): SharedExpenseRow[]`.
- Tests: a direct row of your part when another paid, also when they paid by card; the payer paid now, by credit card (your part, the charge date) and by restaurant card (the total, your part as `personalCents`); no row for a deleted entry, a settlement, a part of zero, a group switched off (another group still gives rows); shares of a placeholder merged into you are yours, and its payment too; the payer's restaurant card row gives the same `countedOn`, `countedCents`, `voucherIncomeOn`, `paidBackCents` and `summarizeMonth` as the same expense of one person alone, and the credit card row as a personal credit card expense of your part; the rows go through `buildList` with your part in the subtotal; over many seeded groups, everybody's counted parts add up to the live expenses and settlements add nothing.
- Commit: `feat: derive your part of the shared expenses for your own lists`

### Task 6: Close the item

- Delete this plan and item 21 of `TODO.md`.
- Commit: `docs: close the shared maths item`

## Review Focus

- `canonicalMember` takes one step: a placeholder is merged only into a user, who is never merged. Data that chains merges would be read wrongly; the server must keep refusing it (item 22).
- The schema doesn't know the group: that `paidBy` and the shares are members, that they haven't left, the currency of the group and the default category are the Worker's checks (item 22).
- The balances trust that each entry's shares add up to its amount (the schema's job); a corrupt stored row would break the zero sum silently.
- `percentsOf` and `splitByPercent` don't round-trip: an entry reopened in percent and saved untouched must keep its cents, which is the form's job (item 25).
- The rows of your part carry `shared`, which a personal expense doesn't: anything that serializes expenses (the JSON export) must not pass shared rows as personal ones (item 27).
- Safe integers: the percent maths multiplies cents by 10 000, which stays under 2^53 only because the amount is capped at `MAX_AMOUNT_CENTS`.
