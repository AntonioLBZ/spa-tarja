import { describe, expect, it } from 'vitest';

import {
    MAX_BUCKETS,
    bucketCount,
    bucketStart,
    categoryTotals,
    defaultRange,
    spendingBuckets,
    spendingTotal,
} from './charts';
import { addDays } from './date';

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

describe('bucketCount', () => {
    it('counts the days of the range, both ends in', () => {
        expect(bucketCount('day', { from: '2026-10-01', to: '2026-10-31' })).toBe(31);
        expect(bucketCount('day', { from: '2026-10-25', to: '2026-10-25' })).toBe(1);
    });

    it('counts the weeks the range touches, from the Monday of the first', () => {
        expect(bucketCount('week', { from: '2026-10-07', to: '2026-10-25' })).toBe(3);
        expect(bucketCount('week', { from: '2026-10-19', to: '2026-10-25' })).toBe(1);
        expect(bucketCount('week', { from: '2026-10-25', to: '2026-10-26' })).toBe(2);
    });

    it('counts the months the range touches', () => {
        expect(bucketCount('month', { from: '2026-08-15', to: '2026-10-31' })).toBe(3);
        expect(bucketCount('month', { from: '2026-10-01', to: '2026-10-31' })).toBe(1);
        expect(bucketCount('month', { from: '2025-11-01', to: '2026-10-25' })).toBe(12);
    });

    it.each(['day', 'week', 'month'] as const)('is zero when the %s range ends before it begins', (granularity) => {
        expect(bucketCount(granularity, { from: '2026-10-25', to: '2026-10-24' })).toBe(0);
    });

    it.each(['day', 'week', 'month'] as const)('says what spendingBuckets builds for %s', (granularity) => {
        const range = { from: '2026-03-17', to: '2026-10-25' };

        expect(spendingBuckets([], { granularity, range, categoryId: null })).toHaveLength(
            bucketCount(granularity, range)
        );
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

    it('counts a restaurant card expense on the day it was made, for your part, not on the day it is charged', () => {
        const dinner = expense({
            date: '2026-10-12',
            amountCents: 4000,
            personalCents: 2000,
            payment: 'voucher',
            chargeDate: '2026-11-12',
        });

        const buckets = spendingBuckets([dinner], {
            granularity: 'month',
            range: { from: '2026-10-01', to: '2026-11-30' },
            categoryId: null,
        });

        expect(buckets).toEqual([
            { start: '2026-10-01', totalCents: 2000 },
            { start: '2026-11-01', totalCents: 0 },
        ]);
    });

    it('counts in full, on the day it was made, a restaurant card expense that says nothing about your part', () => {
        const menu = expense({ date: '2026-09-20', amountCents: 1800, payment: 'voucher', chargeDate: '2026-10-05' });

        const buckets = spendingBuckets([menu], {
            granularity: 'day',
            range: { from: '2026-09-20', to: '2026-10-05' },
            categoryId: null,
        });

        expect(buckets.find((bucket) => bucket.start === '2026-09-20')?.totalCents).toBe(1800);
        expect(buckets.find((bucket) => bucket.start === '2026-10-05')?.totalCents).toBe(0);
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

    it('draws a range of the most it allows, and none for one more bucket', () => {
        const from = '2026-01-01';

        const allowed = spendingBuckets([], {
            granularity: 'day',
            range: { from, to: addDays(from, MAX_BUCKETS - 1) },
            categoryId: null,
        });
        const tooLong = spendingBuckets([], {
            granularity: 'day',
            range: { from, to: addDays(from, MAX_BUCKETS) },
            categoryId: null,
        });

        expect(allowed).toHaveLength(MAX_BUCKETS);
        expect(tooLong).toEqual([]);
    });

    it('has room for a year of days and not for two', () => {
        expect(bucketCount('day', { from: '2024-01-01', to: '2024-12-31' })).toBeLessThanOrEqual(MAX_BUCKETS);
        expect(bucketCount('day', { from: '2025-01-01', to: '2026-12-31' })).toBeGreaterThan(MAX_BUCKETS);
    });

    it('does not try to draw a range that reaches back to the first centuries', () => {
        const buckets = spendingBuckets([], {
            granularity: 'day',
            range: { from: '0202-10-25', to: '2026-10-25' },
            categoryId: null,
        });

        expect(buckets).toEqual([]);
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

describe('spendingTotal', () => {
    const range = { from: '2026-10-01', to: '2026-10-31' };

    it('adds up everything that counts in the range', () => {
        const expenses = [
            expense({ categoryId: 'food', amountCents: 500 }),
            expense({ categoryId: 'leisure', amountCents: 300 }),
            expense({ amountCents: 7, date: '2026-09-30' }),
            expense({ amountCents: 9, deletedAt: 4 }),
            expense({ amountCents: 800, date: '2026-09-20', payment: 'credit', chargeDate: '2026-10-02' }),
        ];

        expect(spendingTotal(expenses, { range, categoryId: null })).toBe(1600);
    });

    it('adds your part of a restaurant card expense, on the day it was made', () => {
        const expenses = [
            expense({
                amountCents: 4000,
                personalCents: 2000,
                date: '2026-10-12',
                payment: 'voucher',
                chargeDate: '2026-11-12',
            }),
            expense({ amountCents: 900, date: '2026-09-28', payment: 'voucher', chargeDate: '2026-10-28' }),
        ];

        expect(spendingTotal(expenses, { range, categoryId: null })).toBe(2000);
        expect(spendingTotal(expenses, { range: { from: '2026-09-01', to: '2026-09-30' }, categoryId: null })).toBe(
            900
        );
    });

    it('can be narrowed to one category', () => {
        const expenses = [
            expense({ categoryId: 'food', amountCents: 500 }),
            expense({ categoryId: 'leisure', amountCents: 300 }),
            expense({ categoryId: 'food', amountCents: 20 }),
        ];

        expect(spendingTotal(expenses, { range, categoryId: 'food' })).toBe(520);
        expect(spendingTotal(expenses, { range, categoryId: 'rent' })).toBe(0);
    });

    it('is zero for nothing, and for a range that ends before it begins', () => {
        expect(spendingTotal([], { range, categoryId: null })).toBe(0);
        expect(spendingTotal([expense()], { range: { from: '2026-10-26', to: '2026-10-24' }, categoryId: null })).toBe(
            0
        );
    });

    it('is the same as what the buckets add up to', () => {
        const expenses = [expense({ amountCents: 500 }), expense({ amountCents: 250, date: '2026-10-03' })];

        const buckets = spendingBuckets(expenses, { granularity: 'week', range, categoryId: null });

        expect(spendingTotal(expenses, { range, categoryId: null })).toBe(
            buckets.reduce((sum, bucket) => sum + bucket.totalCents, 0)
        );
    });
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

    it('breaks a tie by id, so the order never jumps', () => {
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

    it('counts your part of a restaurant card expense, on the day it was made', () => {
        const totals = categoryTotals(
            [
                expense({
                    categoryId: 'food',
                    amountCents: 4000,
                    personalCents: 2000,
                    date: '2026-10-12',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                }),
                expense({ categoryId: 'leisure', amountCents: 2500 }),
                expense({
                    categoryId: 'leisure',
                    amountCents: 700,
                    date: '2026-09-30',
                    payment: 'voucher',
                    chargeDate: '2026-10-30',
                }),
            ],
            range
        );

        expect(totals).toEqual([
            { categoryId: 'leisure', totalCents: 2500 },
            { categoryId: 'food', totalCents: 2000 },
        ]);
    });

    it('is empty when nothing counts in the range', () => {
        expect(categoryTotals([], range)).toEqual([]);
        expect(categoryTotals([expense()], { from: '2026-10-26', to: '2026-10-24' })).toEqual([]);
    });
});

describe('defaultRange', () => {
    const today = '2026-10-25';

    it('is the whole month for days, so what is still to be charged in it shows', () => {
        expect(defaultRange('day', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
        expect(defaultRange('day', '2026-02-03')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    });

    it('is twelve weeks counting this one, up to its Sunday, for weeks', () => {
        expect(defaultRange('week', today)).toEqual({ from: '2026-08-03', to: '2026-10-25' });
        expect(defaultRange('week', '2026-10-21')).toEqual({ from: '2026-08-03', to: '2026-10-25' });
    });

    it('is twelve months counting this one, up to its end, for months', () => {
        expect(defaultRange('month', today)).toEqual({ from: '2025-11-01', to: '2026-10-31' });
    });

    it('holds fewer buckets than are allowed, whatever the grouping', () => {
        for (const granularity of ['day', 'week', 'month'] as const) {
            expect(bucketCount(granularity, defaultRange(granularity, today))).toBeLessThan(MAX_BUCKETS);
        }
    });
});
