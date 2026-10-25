import { describe, expect, it } from 'vitest';

import { bucketStart, categoryTotals, defaultRange, spendingBuckets } from './charts';

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

describe('bucketStart', () => {
    it('is the day itself for days', () => {
        expect(bucketStart('2026-10-25', 'day')).toBe('2026-10-25');
    });

    it('is the Monday of the week for weeks', () => {
        expect(bucketStart('2026-10-25', 'week')).toBe('2026-10-19');
        expect(bucketStart('2026-10-26', 'week')).toBe('2026-10-26');
    });

    it('is the first of the month for months', () => {
        expect(bucketStart('2026-10-25', 'month')).toBe('2026-10-01');
        expect(bucketStart('2026-02-01', 'month')).toBe('2026-02-01');
    });
});

describe('spendingBuckets', () => {
    const range = { from: '2026-10-01', to: '2026-10-31' };

    it('has a bucket for every day of the range, empty ones included, oldest first', () => {
        const buckets = spendingBuckets([expense({ date: '2026-10-02', amountCents: 500 })], {
            granularity: 'day',
            range: { from: '2026-10-01', to: '2026-10-03' },
            categoryId: null,
        });

        expect(buckets).toEqual([
            { start: '2026-10-01', totalCents: 0 },
            { start: '2026-10-02', totalCents: 500 },
            { start: '2026-10-03', totalCents: 0 },
        ]);
    });

    it('adds up what counts on the same day', () => {
        const buckets = spendingBuckets(
            [
                expense({ amountCents: 500 }),
                expense({ amountCents: 250 }),
                expense({ amountCents: 7, date: '2026-10-24' }),
            ],
            { granularity: 'day', range: { from: '2026-10-24', to: '2026-10-25' }, categoryId: null }
        );

        expect(buckets).toEqual([
            { start: '2026-10-24', totalCents: 7 },
            { start: '2026-10-25', totalCents: 750 },
        ]);
    });

    it('groups by week, from the Monday, the first week starting where the range begins in its week', () => {
        const buckets = spendingBuckets(
            [
                expense({ date: '2026-10-07', amountCents: 100 }),
                expense({ date: '2026-10-11', amountCents: 200 }),
                expense({ date: '2026-10-12', amountCents: 400 }),
                expense({ date: '2026-10-25', amountCents: 800 }),
            ],
            { granularity: 'week', range: { from: '2026-10-07', to: '2026-10-25' }, categoryId: null }
        );

        expect(buckets).toEqual([
            { start: '2026-10-05', totalCents: 300 },
            { start: '2026-10-12', totalCents: 400 },
            { start: '2026-10-19', totalCents: 800 },
        ]);
    });

    it('groups by month', () => {
        const buckets = spendingBuckets(
            [
                expense({ date: '2026-08-31', amountCents: 100 }),
                expense({ date: '2026-09-01', amountCents: 200 }),
                expense({ date: '2026-10-31', amountCents: 400 }),
            ],
            { granularity: 'month', range: { from: '2026-08-15', to: '2026-10-31' }, categoryId: null }
        );

        expect(buckets).toEqual([
            { start: '2026-08-01', totalCents: 100 },
            { start: '2026-09-01', totalCents: 200 },
            { start: '2026-10-01', totalCents: 400 },
        ]);
    });

    it('leaves out what counts outside the range, both ends being in', () => {
        const buckets = spendingBuckets(
            [
                expense({ date: '2026-09-30', amountCents: 1 }),
                expense({ date: '2026-10-01', amountCents: 2 }),
                expense({ date: '2026-10-31', amountCents: 4 }),
                expense({ date: '2026-11-01', amountCents: 8 }),
            ],
            { granularity: 'month', range, categoryId: null }
        );

        expect(buckets).toEqual([{ start: '2026-10-01', totalCents: 6 }]);
    });

    it('leaves out deleted expenses', () => {
        const buckets = spendingBuckets([expense({ amountCents: 500 }), expense({ amountCents: 900, deletedAt: 3 })], {
            granularity: 'month',
            range,
            categoryId: null,
        });

        expect(buckets).toEqual([{ start: '2026-10-01', totalCents: 500 }]);
    });

    it('counts a deferred expense on the day it is charged', () => {
        const credit = expense({ date: '2026-09-28', amountCents: 4000, payment: 'credit', chargeDate: '2026-10-05' });

        const buckets = spendingBuckets([credit], {
            granularity: 'day',
            range: { from: '2026-09-28', to: '2026-10-05' },
            categoryId: null,
        });

        expect(buckets.find((bucket) => bucket.start === '2026-09-28')?.totalCents).toBe(0);
        expect(buckets.find((bucket) => bucket.start === '2026-10-05')?.totalCents).toBe(4000);
    });

    it('can be narrowed to one category', () => {
        const buckets = spendingBuckets(
            [
                expense({ categoryId: 'food', amountCents: 500 }),
                expense({ categoryId: 'leisure', amountCents: 300 }),
                expense({ categoryId: 'food', amountCents: 20 }),
            ],
            { granularity: 'month', range, categoryId: 'food' }
        );

        expect(buckets).toEqual([{ start: '2026-10-01', totalCents: 520 }]);
    });

    it.each(['day', 'week', 'month'] as const)(
        'has no %s buckets when the range ends before it begins',
        (granularity) => {
            const buckets = spendingBuckets([expense()], {
                granularity,
                range: { from: '2026-10-25', to: '2026-10-24' },
                categoryId: null,
            });

            expect(buckets).toEqual([]);
        }
    );
});

describe('categoryTotals', () => {
    const range = { from: '2026-10-01', to: '2026-10-31' };

    it('adds up each category, the biggest first', () => {
        const totals = categoryTotals(
            [
                expense({ categoryId: 'leisure', amountCents: 300 }),
                expense({ categoryId: 'food', amountCents: 500 }),
                expense({ categoryId: 'leisure', amountCents: 400 }),
            ],
            range
        );

        expect(totals).toEqual([
            { categoryId: 'leisure', totalCents: 700 },
            { categoryId: 'food', totalCents: 500 },
        ]);
    });

    it('breaks a tie by the name of the category, so the order never jumps', () => {
        const totals = categoryTotals(
            [expense({ categoryId: 'leisure', amountCents: 100 }), expense({ categoryId: 'food', amountCents: 100 })],
            range
        );

        expect(totals.map((total) => total.categoryId)).toEqual(['food', 'leisure']);
    });

    it('counts only what falls in the range, deleted expenses left out, deferred ones where they are charged', () => {
        const totals = categoryTotals(
            [
                expense({ amountCents: 100 }),
                expense({ amountCents: 200, date: '2026-09-30' }),
                expense({ amountCents: 400, deletedAt: 1 }),
                expense({ amountCents: 800, date: '2026-09-20', payment: 'credit', chargeDate: '2026-10-02' }),
            ],
            range
        );

        expect(totals).toEqual([{ categoryId: 'food', totalCents: 900 }]);
    });

    it('is empty when nothing counts in the range', () => {
        expect(categoryTotals([], range)).toEqual([]);
        expect(categoryTotals([expense()], { from: '2026-10-26', to: '2026-10-24' })).toEqual([]);
    });
});

describe('defaultRange', () => {
    const today = '2026-10-25';

    it('is the month so far for days', () => {
        expect(defaultRange('day', today)).toEqual({ from: '2026-10-01', to: today });
    });

    it('is twelve weeks counting this one for weeks', () => {
        expect(defaultRange('week', today)).toEqual({ from: '2026-08-03', to: today });
    });

    it('is twelve months counting this one for months', () => {
        expect(defaultRange('month', today)).toEqual({ from: '2025-11-01', to: today });
    });
});
