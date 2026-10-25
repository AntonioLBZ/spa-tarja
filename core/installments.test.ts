import { describe, expect, it } from 'vitest';

import { MAX_INSTALLMENTS, collapsePlans, installmentDates, planBalance, planTotal, splitEvenly } from './installments';

import type { Expense } from './expense';

function part(id: string, planId: string, number: number, parts: number, overrides: Partial<Expense> = {}): Expense {
    return {
        id,
        categoryId: 'food',
        text: 'Sofa',
        amountCents: 500,
        currency: 'EUR',
        date: '2026-10-25',
        chargeDate: `2026-${String(9 + number)}-25`,
        payment: 'direct',
        plan: { id: planId, part: number, parts },
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        ...overrides,
    };
}

function single(id: string): Expense {
    return {
        id,
        categoryId: 'food',
        text: id,
        amountCents: 100,
        currency: 'EUR',
        date: '2026-10-25',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
    };
}

describe('splitEvenly', () => {
    it.each([
        [1500, 3, [500, 500, 500]],
        [1501, 3, [501, 500, 500]],
        [1502, 3, [501, 501, 500]],
        [100, 3, [34, 33, 33]],
        [1, 2, [1, 0]],
        [999, 1, [999]],
        [1200, 12, Array(12).fill(100)],
    ])('splits %i cents in %i parts, the remainder going to the first ones', (total, parts, expected) => {
        const split = splitEvenly(total, parts);

        expect(split).toEqual(expected);
        expect(split.reduce((sum, cents) => sum + cents, 0)).toBe(total);
    });
});

describe('installmentDates', () => {
    it('counts the first part on the day of the purchase and each next one a month later', () => {
        expect(installmentDates('2026-10-25', 3)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25']);
    });

    it('keeps each part to the last day of a short month, without drifting', () => {
        expect(installmentDates('2026-01-31', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    });
});

describe('planBalance', () => {
    it('is what is left to assign of the total', () => {
        expect(planBalance(1500, [500, 500, 400])).toBe(100);
        expect(planBalance(1500, [500, 500, 500])).toBe(0);
    });

    it('is negative when the parts go over the total', () => {
        expect(planBalance(1500, [500, 500, 600])).toBe(-100);
    });
});

describe('MAX_INSTALLMENTS', () => {
    it('is three years of months', () => {
        expect(MAX_INSTALLMENTS).toBe(36);
    });
});

describe('collapsePlans', () => {
    it('leaves expenses that are not in a plan as they are, in order', () => {
        const items = collapsePlans([single('a'), single('b')]);

        expect(items).toEqual([
            { kind: 'single', expense: single('a') },
            { kind: 'single', expense: single('b') },
        ]);
    });

    it('turns the parts of a plan into one item, in the place of the first part met, parts in order', () => {
        const items = collapsePlans([
            single('a'),
            part('p2', 'plan', 2, 3),
            single('b'),
            part('p1', 'plan', 1, 3),
            part('p3', 'plan', 3, 3),
        ]);

        expect(items.map((item) => item.kind)).toEqual(['single', 'plan', 'single']);
        const plan = items[1];
        expect(plan?.kind === 'plan' && plan.parts.map((item) => item.id)).toEqual(['p1', 'p2', 'p3']);
    });

    it('keeps two plans apart', () => {
        const items = collapsePlans([part('a1', 'one', 1, 2), part('b1', 'two', 1, 2), part('a2', 'one', 2, 2)]);

        expect(items.map((item) => (item.kind === 'plan' ? item.parts.map((p) => p.id) : []))).toEqual([
            ['a1', 'a2'],
            ['b1'],
        ]);
    });
});

describe('planTotal', () => {
    it('adds up the parts', () => {
        const items = collapsePlans([part('a', 'p', 1, 3), part('b', 'p', 2, 3, { amountCents: 701 })]);

        const plan = items[0];
        expect(plan?.kind === 'plan' && planTotal(plan.parts)).toBe(1201);
    });
});
