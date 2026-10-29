import * as v from 'valibot';

import { isCategoryId } from './category';
import { countedCents, countedOn } from './counting';
import { MAX_AMOUNT_CENTS } from './money';
import { monthOf } from './month';

import type { Expense } from './expense';

// The scope of the limit on everything a month counts; any other scope is a category id
const TOTAL_SCOPE = 'total';

// From this share of a limit spent on, a month is near it
const NEAR_PERCENT = 80;

const MAX_LIMITS_PER_REQUEST = 200;

function isBudgetScope(value: unknown): boolean {
    return value === TOTAL_SCOPE || isCategoryId(value);
}

// The limits of one month; an amount of 0 is no limit from that month on
const budgetLimitsSchema = v.object({
    currency: v.pipe(v.string(), v.regex(/^[A-Z]{3}$/)),
    limits: v.pipe(
        v.array(
            v.object({
                scope: v.pipe(
                    v.string(),
                    v.check((scope) => isBudgetScope(scope), 'Not a scope')
                ),
                amountCents: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_AMOUNT_CENTS)),
            })
        ),
        v.minLength(1),
        v.maxLength(MAX_LIMITS_PER_REQUEST),
        v.check(
            (limits) => new Set(limits.map((limit) => limit.scope)).size === limits.length,
            'A scope is given twice'
        )
    ),
});

type BudgetLimitsInput = v.InferOutput<typeof budgetLimitsSchema>;

// What a month sets for a scope; the months after it hold it until another row sets theirs
type Budget = { month: string; scope: string; amountCents: number; currency: string };

type BudgetState = 'none' | 'near' | 'over';

// What a scope with a limit has used in a month; `since` is the month of the row the limit comes from
interface BudgetUse {
    scope: string;
    limitCents: number;
    since: string;
    spentCents: number;
    percent: number;
    state: BudgetState;
}

// The limit a scope holds in a month: the row of the latest month up to it, or none when there is no such row or its
// amount is 0 (ADR-0009)
function limitFor(budgets: readonly Budget[], scope: string, month: string): { cents: number; since: string } | null {
    let latest: Budget | null = null;
    for (const row of budgets) {
        if (row.scope !== scope || row.month > month) continue;
        if (latest === null || row.month > latest.month) latest = row;
    }
    return latest === null || latest.amountCents === 0 ? null : { cents: latest.amountCents, since: latest.month };
}

function percentOf(part: number, whole: number): number {
    return Math.round((part * 100) / whole);
}

function stateOf(spentCents: number, limitCents: number | null): BudgetState {
    if (limitCents === null) return 'none';
    if (spentCents > limitCents) return 'over';
    return spentCents * 100 >= limitCents * NEAR_PERCENT ? 'near' : 'none';
}

// What counts toward a scope in a month: the total adds everything, a category what is filed under it, with a category
// that no longer exists read as `categoryOf` says
function spentFor(
    expenses: readonly Expense[],
    scope: string,
    month: string,
    categoryOf: (categoryId: string) => string
): number {
    let spent = 0;
    for (const expense of expenses) {
        if (expense.deletedAt !== null || monthOf(countedOn(expense)) !== month) continue;
        if (scope === TOTAL_SCOPE || categoryOf(expense.categoryId) === scope) spent += countedCents(expense);
    }
    return spent;
}

// The use of every listed scope that holds a limit in the month, in the order listed
function budgetUses(input: {
    month: string;
    expenses: readonly Expense[];
    budgets: readonly Budget[];
    scopes: readonly string[];
    categoryOf: (categoryId: string) => string;
}): BudgetUse[] {
    const { month, expenses, budgets, scopes, categoryOf } = input;

    return scopes.flatMap((scope) => {
        const limit = limitFor(budgets, scope, month);
        if (limit === null) return [];
        const spentCents = spentFor(expenses, scope, month, categoryOf);
        return [
            {
                scope,
                limitCents: limit.cents,
                since: limit.since,
                spentCents,
                percent: percentOf(spentCents, limit.cents),
                state: stateOf(spentCents, limit.cents),
            },
        ];
    });
}

export {
    NEAR_PERCENT,
    TOTAL_SCOPE,
    budgetLimitsSchema,
    budgetUses,
    isBudgetScope,
    limitFor,
    percentOf,
    spentFor,
    stateOf,
};
export type { Budget, BudgetLimitsInput, BudgetState, BudgetUse };
