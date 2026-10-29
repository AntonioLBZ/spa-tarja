import { TOTAL_SCOPE, limitFor, percentOf, spentFor, stateOf, type Budget, type BudgetState } from './budget';
import { countedOn } from './counting';
import { monthOf } from './month';
import { summarizeMonth } from './summary';

import type { Expense } from './expense';
import type { Income } from './income';

// What an added expense did to a month: its leftover fell below zero, or a limit was passed, or came near. `percent` is
// the use of the limit, none for the leftover.
interface BudgetWarning {
    kind: 'negative' | 'over' | 'near';
    month: string;
    scope: string;
    percent: number | null;
}

const SEVERITY: Record<BudgetWarning['kind'], number> = { negative: 0, over: 1, near: 2 };
const RANK: Record<BudgetState, number> = { none: 0, near: 1, over: 2 };

function moreSerious(a: BudgetWarning, b: BudgetWarning): number {
    return (
        SEVERITY[a.kind] - SEVERITY[b.kind] ||
        (a.month < b.month ? -1 : a.month > b.month ? 1 : 0) ||
        (b.percent ?? 0) - (a.percent ?? 0)
    );
}

// The one thing to tell the person after they add expenses: the most serious state crossed, in any month they count
// in, or null when none was. A state a month was already in is not crossed again.
function budgetWarning(input: {
    before: readonly Expense[];
    added: readonly Expense[];
    budgets: readonly Budget[];
    income: readonly Income[];
    scopes: readonly string[];
    categoryOf: (categoryId: string) => string;
}): BudgetWarning | null {
    const { before, added, budgets, income, scopes, categoryOf } = input;
    const after = [...before, ...added];
    const months = new Set(
        added.filter((expense) => expense.deletedAt === null).map((expense) => monthOf(countedOn(expense)))
    );
    const found: BudgetWarning[] = [];

    for (const month of months) {
        const earned = income.find((item) => item.month === month)?.amountCents ?? null;
        if (earned !== null) {
            const leftBefore = summarizeMonth(month, before, earned).leftCents ?? 0;
            const leftAfter = summarizeMonth(month, after, earned).leftCents ?? 0;
            if (leftBefore >= 0 && leftAfter < 0)
                found.push({ kind: 'negative', month, scope: TOTAL_SCOPE, percent: null });
        }

        for (const scope of scopes) {
            const limit = limitFor(budgets, scope, month);
            if (limit === null) continue;
            const was = stateOf(spentFor(before, scope, month, categoryOf), limit.cents);
            const spent = spentFor(after, scope, month, categoryOf);
            const now = stateOf(spent, limit.cents);
            if (now !== 'none' && RANK[now] > RANK[was]) {
                found.push({ kind: now, month, scope, percent: percentOf(spent, limit.cents) });
            }
        }
    }

    return found.toSorted(moreSerious)[0] ?? null;
}

export { budgetWarning };
export type { BudgetWarning };
