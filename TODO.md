# TODO

Items build on each other in the order they appear below. Delete an item when it is done and its docs are updated; the numbers stay.

## Needs the owner

- Check the layout on a real iOS Safari and Android Chrome (safe areas, keyboard, install, the Undo toast and that the backup and the spreadsheet download from the installed app), and the visual identity there: the Dot Matrix logo in the header, the amber accent (one of those the user can pick) next to the orange and yellow category icons, and the slide between screens (a browser without view transitions, like iOS Safari before 18, just switches).
- Offline, the income and new-category fields still look enabled while their buttons are disabled; disable the fields too?
- The spreadsheet writes the part of a plan as `2/3`, which Excel and Google Sheets may read as a date (2 March). Keep it as you asked, or write it another way (`2 of 3`, or two columns)?
- The selected column of the spending chart turns ink, which in the gray accent in dark is a weak change (`design.md` §8). Give it an ink frame instead?

## 15. Budgets (L)

Spec: `ARCHITECTURE.md` §5 "Budgets" and `design.md` §5 "Budgets", approved by the owner on 2026-10-29. This is the plan; delete the item when the last task is done.

**Goal:** a limit for a month's total and for each category, shown as bars in the Summary, edited on `/budgets`, and a warning inside the app when an added expense crosses one.

**Architecture:** a `budget` table with one row per user, month and scope, read like the income (persisted cache, a connection to change it). `core/budget.ts` finds the limit of a month (the latest row up to it) and works out its use; `core/budget-warning.ts` compares the state before and after an added expense. The client draws the bars, edits the limits and warns.

**How every task runs:** update the docs it touches first, write the failing tests and watch them fail, write the minimal code, then `pnpm test`, `pnpm types:check`, `pnpm lint` and `pnpm format:check` must be green, and commit with the subject given. No push.

**Global constraints** (values of the spec)

- Money is an integer in cents; the currency goes through `DEFAULT_CURRENCY`; what an expense counts and where goes through `countedCents` and `countedOn`.
- `amount_cents` 0 means no limit; the key is `(user_id, month, scope)`; `scope` is `total` or a category id. Near is 80 % or more of the limit, over is strictly more. Migration `0009` only adds. A `PUT` takes 1 to 200 limits, each scope once.
- A percentage is never typed or stored; shown as `round(part ÷ whole × 100)`.
- The `Toast` is the only place a warning shows, for 8 s, naming the month.
- English in code and docs; UI copy in `en.json` and `es.json` (the key parity test); imports `./`, `@/`, `@core/`, `@server/`; no comments in tests; colors only from the existing tokens (`--color-danger` over a limit); touch targets of `--size-touch`; mobile-first CSS.

**Review focus** (not in the spec, each pinned by a test of the task named)

1. A limit set to 0 in a month ends it for the later months with no row, while a later month with its own row keeps it (Task 1).
2. An expense whose category was deleted counts as "Other", and the rows of a deleted category show nowhere and are deleted by the server (Tasks 1, 3, 7).
3. `/budgets` offline on a device whose cache never held the budgets: empty fields, a disabled form, no crash; no budgets loaded means no warning (Tasks 6, 8).
4. Typed amounts: `abc`, `-5`, `1.234,50`, `0,00` and one beyond the maximum (Task 6).
5. A credit card expense or a plan that crosses in a month later than the one it was made: the warning names the month it counts in (Task 2).

### Task 1: the limit of a month and its use (`core/budget.ts`)

**Files:** create `core/budget.ts` and `core/budget.test.ts`.

**Produces:**

```ts
const TOTAL_SCOPE = 'total';
const NEAR_PERCENT = 80;
const budgetLimitsSchema; // valibot: { currency: /^[A-Z]{3}$/, limits: [{ scope, amountCents: integer 0..MAX_AMOUNT_CENTS }] }, 1 to 200 entries, scopes unique
type BudgetLimitsInput = v.InferOutput<typeof budgetLimitsSchema>;
type Budget = { month: string; scope: string; amountCents: number; currency: string };
type BudgetState = 'none' | 'near' | 'over';
interface BudgetUse {
    scope: string;
    limitCents: number;
    since: string;
    spentCents: number;
    percent: number;
    state: BudgetState;
}
function isBudgetScope(value: unknown): boolean; // TOTAL_SCOPE, a default id or a UUID (`isCategoryId`)
function limitFor(budgets: readonly Budget[], scope: string, month: string): { cents: number; since: string } | null;
function percentOf(part: number, whole: number): number;
function stateOf(spentCents: number, limitCents: number | null): BudgetState;
function spentFor(
    expenses: readonly Expense[],
    scope: string,
    month: string,
    categoryOf: (categoryId: string) => string
): number;
function budgetUses(input: {
    month: string;
    expenses: readonly Expense[];
    budgets: readonly Budget[];
    scopes: readonly string[];
    categoryOf: (categoryId: string) => string;
}): BudgetUse[]; // only the scopes with a limit, in the order of `scopes`
```

**Tests:** `limitFor` takes the latest row up to the month and ignores later ones; none before the first row; a row of the month wins over an earlier one; a 0 is no limit and ends the earlier limit for the months after it with no row, while a later month with its own row keeps it; scopes are independent; `since` is the month of the row. `percentOf(30000, 150000)` is 20, `percentOf(1, 3)` 33, `percentOf(150, 100)` 150. `stateOf`: 7999 of 10000 `none`, 8000 and 10000 `near`, 10001 `over`, no limit `none`. `spentFor`: the total adds every category by the month of `countedOn` (a credit card counts in its charge month, a restaurant card at your part), a category scope only its own, an unknown category counts as `other` through `categoryOf`, deleted expenses are skipped. `budgetUses` has the percent and state of each scope with a limit and none for the rest. The schema accepts `total`, a default id and a UUID, accepts 0, and rejects `food2`, a negative or fractional or too large amount, a repeated scope, no entries and 201 entries. No default category id is `total`.

- [ ] Tests, fail, implement, green. Commit: `feat: work out the limit of a month and how much of it is used`

### Task 2: the warning for an added expense (`core/budget-warning.ts`)

**Files:** create `core/budget-warning.ts` and `core/budget-warning.test.ts`.

**Consumes:** Task 1, `summarizeMonth` (`core/summary.ts`), `countedOn`, `monthOf`.

**Produces:**

```ts
interface BudgetWarning {
    kind: 'negative' | 'over' | 'near';
    month: string;
    scope: string;
    percent: number | null;
} // percent: the use of the limit; null for 'negative'
function budgetWarning(input: {
    before: readonly Expense[];
    added: readonly Expense[];
    budgets: readonly Budget[];
    income: readonly Income[];
    scopes: readonly string[];
    categoryOf: (categoryId: string) => string;
}): BudgetWarning | null;
```

**Tests:** none to near (7000 plus 1500 of 10000 warns near at 85), none to over, near to over; near to near and over to over do not warn; no limit does not warn; the leftover going from 0 or more to below 0 warns `negative` with an income, and does not when it was already below zero or there is no income; the order is `negative`, then `over`, then `near`, and on a tie the earliest month, then the highest percent; a credit card expense made in October and charged in November warns for November; a plan warns for the most serious of its parts across months; an unknown category counts under `other`.

- [ ] Tests, fail, implement, green. Commit: `feat: warn when an added expense crosses a limit`

### Task 3: the table, the API and the category delete

**Files:** create `db/migrations/0009_budgets.sql`, `server/db/budgets.ts`, `server/routes/budgets.ts`, `server/routes/budgets.test.ts`; modify `server/app.ts` (`.use('/budgets/*', withUser)` and `.route('/budgets', budgetsRoutes)`), `server/db/categories.ts` (`deleteCategory` also deletes the budget rows of that scope for that user, in one `db.batch`), `server/routes/categories.test.ts`, `server/test/apply-migrations.ts` (`DELETE FROM budget` before each test), `AGENTS.md` and `ARCHITECTURE.md` §8 (`/api/budgets` needs a session).

**Produces:** `budget (user_id TEXT NOT NULL, month TEXT NOT NULL, scope TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0), currency TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (user_id, month, scope))`;

```ts
function listBudgets(db: D1Database, userId: string): Promise<Budget[]>; // by month, then scope
function saveBudgets(db: D1Database, userId: string, month: string, input: BudgetLimitsInput): Promise<Budget[]>; // one batch of upserts with RETURNING
```

`GET /api/budgets` answers `{ budgets: Budget[] }`; `PUT /api/budgets/:month` (validated with `monthSchema` and `budgetLimitsSchema`) answers `{ budgets: Budget[] }`, the rows it saved.

**Tests:** both routes answer 401 without a session; the list starts empty, is ordered and holds only the caller's rows; a `PUT` saves each limit and saving the same month and scope again leaves one row with the new amount; a 0 is stored; repeating a request changes nothing; a bad month, a bad scope, a repeated scope, a negative amount and an empty list answer 400 and write nothing; another user's rows are never touched; deleting a category deletes its rows and the `total` and other categories' rows stay, and another user's rows with that scope stay too.

- [ ] Docs, tests, fail, implement, green. Commit: `feat: store and serve the budgets`

### Task 4: the client reads and keeps the budgets

**Files:** create `src/lib/api/budgets.ts`; modify `src/lib/api/index.ts` and `src/lib/api/queries.ts` (`budgetsQuery()`), `src/lib/offline/persister.ts` (`BUDGETS_KEY[0]` joins `PERSISTED_QUERIES`) and its test, `src/lib/test/fake-api.ts`, `ARCHITECTURE.md` §6 (reads and exceptions to the outbox name the budgets).

**Produces:** `BUDGETS_KEY = ['budgets'] as const`; `fetchBudgets(): Promise<Budget[]>`; `putBudgets(month: string, input: BudgetLimitsInput): Promise<Budget[]>`; `budgetsQuery()`. The fake API takes `budgets?: Budget[]`, answers `GET /api/budgets` and `PUT /api/budgets/:month` (replacing the rows of that month and scope, 0 included), records `budgetRequests: string[]` (`PUT 2026-10`) and `budgetBodies: unknown[]`, and answers every write with `state.budgetWriteStatus` when it is not null.

**Tests:** the persister test lists `budgets` among the persisted queries; a new `src/lib/api/budgets.test.ts` covers `fetchBudgets` and `putBudgets` against the fake API and a failed write throwing `ApiError`.

- [ ] Docs, tests, fail, implement, green. Commit: `feat: read the budgets and keep them offline`

### Task 5: the backup holds the budgets

**Files:** modify `core/export.ts` (`BackupData` gets `budgets: readonly Budget[]`, `Backup` and `buildBackup` get `budgets`, ordered by month then scope), `core/export.test.ts`, `src/features/export/your-data.tsx` (reads `budgetsQuery()`), `src/features/export/your-data.test.tsx`, `ARCHITECTURE.md` §5 (backup text: the JSON and what Settings reads).

**Tests:** `buildBackup` has `budgets` in order; the settings backup file holds the budgets the device has; with no budgets it holds `[]`; offline it still does, from the cache.

- [ ] Docs, tests, fail, implement, green. Commit: `feat: include the budgets in the backup`

### Task 6: the `/budgets` screen

**Files:** create `src/components/month-switch/month-switch.tsx` and `.css` (the previous and next arrows with the month name, moved out of `summary.tsx`, props `{ monthName: string; onPrevious: () => void; onNext: () => void }`, with the `summary__month` styles; its two labels become the keys `monthSwitch.previous` and `monthSwitch.next` in both locale files, replacing `summary.previousMonth` and `summary.nextMonth`, and the tests that name them follow), `src/features/budgets/use-budgets.ts`, `use-budget-actions.ts`, `budgets.tsx`, `budgets.css`, `budgets.test.tsx`, `src/routes/budgets.tsx`; modify `src/features/summary/summary.tsx` (uses `MonthSwitch`; a "Budgets" link beside the charts link), `src/lib/route-transition.ts` (`/budgets` at depth 2, under `/summary`), `src/routes/routes.test.tsx`, `src/routeTree.gen.ts` (generated), both locale files, `design.md` §3 (Components lists `MonthSwitch`) and §6 (routes).

**Produces:**

```ts
function useBudgets(): {
    budgets: Budget[];
    scopes: string[];
    categoryOf: (categoryId: string) => string;
    isError: boolean;
}; // rows of unknown scopes left out; scopes = [TOTAL_SCOPE, ...category ids in list order]
function useBudgetActions(): { save: (month: string, input: BudgetLimitsInput) => Promise<void> }; // PUT, then the cache takes the saved rows
```

**Tests** (`budgets.test.tsx`, `/budgets` with the fake API): opens on the current month with a field for the total and for each category, built-in and custom, empty without limits; a limit held from an earlier month fills the field and says "Set in October"; with an income of the month a line "20 % of the income" shows for a field with a limit and can pass 100, and none shows without an income; Save is disabled until a field changes and then sends only the changed fields in one `PUT`; an empty or `0` field that had a limit sends 0, and one that had none sends nothing; typing again the limit the field already holds, an inherited one included, is not a change; `abc`, `-5` and one beyond the maximum mark the field invalid and send nothing, and `1.234,50` and `0,00` are read; after a save the fields show what was saved and the next month shows "Set in …"; a failed save shows an alert and keeps what was typed; offline the form is disabled with a notice and the values show from the cache, and with an empty cache the fields are empty; the arrows change the month.

- [ ] Docs, tests, fail, implement, green. Commit: `feat: set the limits of a month on a budgets screen`

### Task 7: the bars in the Summary

**Files:** create `src/features/budgets/budget-bars.tsx`, `budget-bars.css`; modify `src/features/summary/summary.tsx` (renders `<BudgetBars month={month} />` between the numbers and the income form), `src/features/summary/summary.test.tsx`, both locale files, `design.md` §5 (drop the "not built yet" note of the bars).

**Consumes:** Task 1 `budgetUses`, Task 6 `useBudgets`, `useExpenses`.

**Tests:** no bars when the month holds no limit; the total first and then the categories in the order of the list, only those with a limit; the text "€120.00 of €300.00" and "40 %"; near (80 to 100 %) has no danger style, over has the danger modifier and "over by €20.00"; a limit held from an earlier month shows in a later one and a 0 in the month hides it; a credit card expense counts in the bar of its charge month; an expense of a deleted category counts in "Other" and a row of a deleted category shows no bar; the bar is `aria-hidden` and the text is what a screen reader gets.

- [ ] Docs, tests, fail, implement, green. Commit: `feat: show how much of each limit is used in the summary`

### Task 8: the warning when adding

**Files:** modify `src/components/toast/toast.tsx` (`action` becomes optional: no button without it) and `toast.test.tsx`, create `src/features/budgets/use-budget-warning.ts`, modify `src/features/expenses/expense-form.tsx` (after `save`, for an added or duplicated expense, never an edit), `src/features/expenses/expenses.test.tsx` or a new `src/features/budgets/budget-warning.test.tsx`, both locale files (`budgets.warning.{near,nearTotal,over,overTotal,negative}`), `design.md` §3 (Toast: the action is optional) and §5 (drop the "not built yet" note of the warnings).

**Produces:** `useBudgetWarning(): (added: readonly Expense[]) => void`, which reads the expenses, budgets, income and categories of its render (so `before` is what was there before the save) and calls `toast.show({ message })` with the month named by `Intl.DateTimeFormat(locale, { month: 'long' })` and the category by `labelOf`.

**Tests:** a `Toast` without an action has no button and still goes after 8 s; adding an expense that takes Food from 70 % to 90 % shows "Food of October is at 90 % of its limit", from 90 % to 110 % "went over", the total says "The total of October …", and a leftover going below zero says "This leaves October below zero"; an expense that crosses nothing, editing and deleting show nothing; duplicating warns like adding; no budgets in the cache means no toast; an expense charged next month names that month.

- [ ] Docs, tests, fail, implement, green. Commit: `feat: warn when an added expense brings a limit near or over`

### Task 9: close the loop

**Files:** modify `ARCHITECTURE.md` (§5 "Budgets": drop the "not built yet" note; §11 roadmap), `design.md`, `AGENTS.md` (the lists that name the incomes: offline exceptions, shared components with `MonthSwitch` and the optional action of `Toast`), `TODO.md` (delete this item).

- [ ] `pnpm build`, the whole suite, and a pass in the real app on a local test user (the Budgets screen, the bars, each warning, offline). Review the commits of the plan with `/code-review` and fix what it finds. Commit: `docs: close the budgets`

## Far future (an idea to keep in mind, not planned)

A Splitwise-like function: expenses shared between people, who paid, who owes whom and settling up. It is out of scope today (`ARCHITECTURE.md` §1) and would change the model: every row belongs to one user, so it needs groups, invitations between Google accounts, access rules on the server, balances, and a way to relate it to "your part" of an expense and to the offline sync. Nothing to do now.
