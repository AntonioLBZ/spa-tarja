import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
    NEAR_PERCENT,
    TOTAL_SCOPE,
    budgetLimitsSchema,
    budgetUses,
    isBudgetScope,
    limitFor,
    percentOf,
    spentFor,
    stateOf,
    type Budget,
} from './budget';
import { DEFAULT_CATEGORY_IDS } from './categories';
import { MAX_AMOUNT_CENTS } from './money';

import type { Expense } from './expense';

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1000,
        currency: 'EUR',
        date: '2026-10-25',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        ...overrides,
    };
}

function budget(month: string, scope: string, amountCents: number): Budget {
    return { month, scope, amountCents, currency: 'EUR' };
}

const known = new Set(['food', 'leisure', 'other']);
const categoryOf = (categoryId: string) => (known.has(categoryId) ? categoryId : 'other');

describe('limitFor', () => {
    it('is the row of the latest month up to the one asked, and ignores the later ones', () => {
        const budgets = [budget('2026-08', 'food', 10_000), budget('2026-10', 'food', 20_000)];

        expect(limitFor(budgets, 'food', '2026-09')).toEqual({ cents: 10_000, since: '2026-08' });
        expect(limitFor(budgets, 'food', '2026-12')).toEqual({ cents: 20_000, since: '2026-10' });
        expect(limitFor([budget('2026-11', 'food', 5_000)], 'food', '2026-10')).toBeNull();
    });

    it('has none before the first row and none without rows', () => {
        expect(limitFor([budget('2026-10', 'food', 10_000)], 'food', '2026-09')).toBeNull();
        expect(limitFor([], 'food', '2026-10')).toBeNull();
    });

    it('takes the row of the month itself over an earlier one', () => {
        const budgets = [budget('2026-09', 'food', 10_000), budget('2026-10', 'food', 30_000)];

        expect(limitFor(budgets, 'food', '2026-10')).toEqual({ cents: 30_000, since: '2026-10' });
    });

    it('reads a 0 as no limit, ending the earlier one for the months after it with no row of their own', () => {
        const budgets = [budget('2026-08', 'food', 10_000), budget('2026-10', 'food', 0)];

        expect(limitFor(budgets, 'food', '2026-09')).toEqual({ cents: 10_000, since: '2026-08' });
        expect(limitFor(budgets, 'food', '2026-10')).toBeNull();
        expect(limitFor(budgets, 'food', '2026-12')).toBeNull();
    });

    it('lets a later month with its own row keep it after a 0', () => {
        const budgets = [
            budget('2026-08', 'food', 10_000),
            budget('2026-10', 'food', 0),
            budget('2026-12', 'food', 15_000),
        ];

        expect(limitFor(budgets, 'food', '2026-11')).toBeNull();
        expect(limitFor(budgets, 'food', '2026-12')).toEqual({ cents: 15_000, since: '2026-12' });
        expect(limitFor(budgets, 'food', '2027-01')).toEqual({ cents: 15_000, since: '2026-12' });
    });

    it('keeps each scope apart, the total included', () => {
        const budgets = [budget('2026-10', 'food', 10_000), budget('2026-10', TOTAL_SCOPE, 90_000)];

        expect(limitFor(budgets, TOTAL_SCOPE, '2026-10')?.cents).toBe(90_000);
        expect(limitFor(budgets, 'food', '2026-10')?.cents).toBe(10_000);
        expect(limitFor(budgets, 'leisure', '2026-10')).toBeNull();
    });
});

describe('percentOf', () => {
    it('is a whole percentage, rounded, with no ceiling', () => {
        expect(percentOf(30_000, 150_000)).toBe(20);
        expect(percentOf(1, 3)).toBe(33);
        expect(percentOf(2, 3)).toBe(67);
        expect(percentOf(150, 100)).toBe(150);
        expect(percentOf(0, 100)).toBe(0);
    });
});

describe('stateOf', () => {
    it('is near from 80 % of the limit and over once it is passed', () => {
        expect(NEAR_PERCENT).toBe(80);
        expect(stateOf(7_999, 10_000)).toBe('none');
        expect(stateOf(8_000, 10_000)).toBe('near');
        expect(stateOf(10_000, 10_000)).toBe('near');
        expect(stateOf(10_001, 10_000)).toBe('over');
    });

    it('is none without a limit', () => {
        expect(stateOf(50_000, null)).toBe('none');
    });
});

describe('spentFor', () => {
    it('adds what counts in the month for the total, whichever category it has', () => {
        const expenses = [
            expense({ amountCents: 1000 }),
            expense({ amountCents: 250, categoryId: 'leisure' }),
            expense({ amountCents: 999, date: '2026-09-30' }),
        ];

        expect(spentFor(expenses, TOTAL_SCOPE, '2026-10', categoryOf)).toBe(1250);
    });

    it('counts a credit card expense in the month it is charged', () => {
        const credit = expense({ amountCents: 4000, payment: 'credit', date: '2026-10-28', chargeDate: '2026-11-12' });

        expect(spentFor([credit], TOTAL_SCOPE, '2026-10', categoryOf)).toBe(0);
        expect(spentFor([credit], 'food', '2026-11', categoryOf)).toBe(4000);
    });

    it('counts your part of a restaurant card expense in the month it was made', () => {
        const dinner = expense({
            amountCents: 4000,
            payment: 'voucher',
            personalCents: 2000,
            date: '2026-10-12',
            chargeDate: '2026-11-12',
        });

        expect(spentFor([dinner], 'food', '2026-10', categoryOf)).toBe(2000);
        expect(spentFor([dinner], 'food', '2026-11', categoryOf)).toBe(0);
    });

    it('counts only its own category for a category scope', () => {
        const expenses = [expense({ amountCents: 1000 }), expense({ amountCents: 250, categoryId: 'leisure' })];

        expect(spentFor(expenses, 'leisure', '2026-10', categoryOf)).toBe(250);
    });

    it('counts an expense whose category no longer exists as Other', () => {
        const orphan = expense({ amountCents: 700, categoryId: crypto.randomUUID() });

        expect(spentFor([orphan], 'other', '2026-10', categoryOf)).toBe(700);
        expect(spentFor([orphan], 'food', '2026-10', categoryOf)).toBe(0);
    });

    it('skips the deleted ones', () => {
        expect(spentFor([expense({ deletedAt: 5 })], TOTAL_SCOPE, '2026-10', categoryOf)).toBe(0);
    });
});

describe('budgetUses', () => {
    const scopes = [TOTAL_SCOPE, 'food', 'leisure'];

    it('has the use of each scope that holds a limit, in the order of the scopes, and none for the rest', () => {
        const uses = budgetUses({
            month: '2026-10',
            expenses: [expense({ amountCents: 12_000 }), expense({ amountCents: 1_000, categoryId: 'leisure' })],
            budgets: [budget('2026-09', TOTAL_SCOPE, 50_000), budget('2026-10', 'food', 10_000)],
            scopes,
            categoryOf,
        });

        expect(uses).toEqual([
            {
                scope: TOTAL_SCOPE,
                limitCents: 50_000,
                since: '2026-09',
                spentCents: 13_000,
                percent: 26,
                state: 'none',
            },
            { scope: 'food', limitCents: 10_000, since: '2026-10', spentCents: 12_000, percent: 120, state: 'over' },
        ]);
    });

    it('is near at 80 % and none under it', () => {
        const uses = budgetUses({
            month: '2026-10',
            expenses: [expense({ amountCents: 8_000 })],
            budgets: [budget('2026-10', 'food', 10_000)],
            scopes,
            categoryOf,
        });

        expect(uses[0]).toMatchObject({ percent: 80, state: 'near' });
    });

    it('leaves out a scope whose limit is 0 and one nobody lists', () => {
        const uses = budgetUses({
            month: '2026-10',
            expenses: [],
            budgets: [budget('2026-10', 'food', 0), budget('2026-10', 'ghost', 5_000)],
            scopes,
            categoryOf,
        });

        expect(uses).toEqual([]);
    });
});

describe('isBudgetScope', () => {
    it('takes the total, a default category id and a UUID', () => {
        expect(isBudgetScope(TOTAL_SCOPE)).toBe(true);
        expect(isBudgetScope('food')).toBe(true);
        expect(isBudgetScope(crypto.randomUUID())).toBe(true);
    });

    it('refuses anything else', () => {
        expect(isBudgetScope('food2')).toBe(false);
        expect(isBudgetScope('')).toBe(false);
        expect(isBudgetScope(7)).toBe(false);
    });

    it('never takes the id of a default category for the total', () => {
        expect((DEFAULT_CATEGORY_IDS as readonly string[]).includes(TOTAL_SCOPE)).toBe(false);
    });
});

describe('budgetLimitsSchema', () => {
    const valid = { currency: 'EUR', limits: [{ scope: 'food', amountCents: 30_000 }] };

    it('takes a currency and limits with a scope and an amount in cents', () => {
        expect(v.is(budgetLimitsSchema, valid)).toBe(true);
        expect(v.is(budgetLimitsSchema, { ...valid, limits: [{ scope: TOTAL_SCOPE, amountCents: 1 }] })).toBe(true);
        expect(v.is(budgetLimitsSchema, { ...valid, limits: [{ scope: crypto.randomUUID(), amountCents: 1 }] })).toBe(
            true
        );
    });

    it('takes a 0, which is no limit, and the greatest amount', () => {
        expect(v.is(budgetLimitsSchema, { ...valid, limits: [{ scope: 'food', amountCents: 0 }] })).toBe(true);
        expect(v.is(budgetLimitsSchema, { ...valid, limits: [{ scope: 'food', amountCents: MAX_AMOUNT_CENTS }] })).toBe(
            true
        );
    });

    it('refuses a bad scope', () => {
        expect(v.is(budgetLimitsSchema, { ...valid, limits: [{ scope: 'food2', amountCents: 1 }] })).toBe(false);
    });

    it('refuses an amount that is negative, fractional or too large', () => {
        for (const amountCents of [-1, 1.5, MAX_AMOUNT_CENTS + 1]) {
            expect(v.is(budgetLimitsSchema, { ...valid, limits: [{ scope: 'food', amountCents }] })).toBe(false);
        }
    });

    it('refuses a bad currency', () => {
        expect(v.is(budgetLimitsSchema, { ...valid, currency: 'eur' })).toBe(false);
    });

    it('refuses a scope given twice', () => {
        const limits = [
            { scope: 'food', amountCents: 1 },
            { scope: 'food', amountCents: 2 },
        ];

        expect(v.is(budgetLimitsSchema, { ...valid, limits })).toBe(false);
    });

    it('takes from 1 to 200 limits', () => {
        const limits = (count: number) =>
            Array.from({ length: count }, () => ({ scope: crypto.randomUUID(), amountCents: 1 }));

        expect(v.is(budgetLimitsSchema, { ...valid, limits: [] })).toBe(false);
        expect(v.is(budgetLimitsSchema, { ...valid, limits: limits(200) })).toBe(true);
        expect(v.is(budgetLimitsSchema, { ...valid, limits: limits(201) })).toBe(false);
    });
});
