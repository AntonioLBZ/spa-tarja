import { describe, expect, it } from 'vitest';

import {
    MAX_BUCKETS,
    bucketCount,
    bucketStart,
    categoryTotals,
    comparison,
    defaultRange,
    niceScale,
    previousRange,
    spendingBuckets,
    spendingTotal,
} from './charts';
import { addDays, daysBetween } from './date';

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

    it('leaves out a category that adds up to nothing, like a restaurant card expense with none of it yours', () => {
        const totals = categoryTotals(
            [
                expense({
                    categoryId: 'food',
                    amountCents: 4000,
                    personalCents: 0,
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                }),
            ],
            range
        );

        expect(totals).toEqual([]);
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

describe('niceScale', () => {
    it('stops at the first round amount that holds the biggest value', () => {
        expect(niceScale(4899)).toEqual({ max: 5000, step: 2500, ticks: [0, 2500, 5000] });
        expect(niceScale(5001)).toEqual({ max: 6000, step: 2000, ticks: [0, 2000, 4000, 6000] });
        expect(niceScale(12_000)).toEqual({ max: 15_000, step: 5000, ticks: [0, 5000, 10_000, 15_000] });
    });

    it('keeps a value that is already round as its top', () => {
        expect(niceScale(5000)).toEqual({ max: 5000, step: 2500, ticks: [0, 2500, 5000] });
    });

    it('takes the most ticks when two steps reach the same top', () => {
        expect(niceScale(10_000)).toEqual({ max: 10_000, step: 2500, ticks: [0, 2500, 5000, 7500, 10_000] });
    });

    it('steps by whole cents for the smallest amounts', () => {
        expect(niceScale(1)).toEqual({ max: 2, step: 1, ticks: [0, 1, 2] });
        expect(niceScale(3)).toEqual({ max: 3, step: 1, ticks: [0, 1, 2, 3] });
    });

    it('draws one euro when there is nothing to show', () => {
        expect(niceScale(0)).toEqual({ max: 100, step: 25, ticks: [0, 25, 50, 75, 100] });
    });

    it('draws one euro for what is not a finite amount', () => {
        expect(niceScale(Infinity)).toEqual(niceScale(0));
        expect(niceScale(Number.NaN)).toEqual(niceScale(0));
        expect(niceScale(-5)).toEqual(niceScale(0));
    });

    it('rounds a fraction of a cent up to a whole one', () => {
        expect(niceScale(0.5)).toEqual(niceScale(1));
        expect(niceScale(4898.2)).toEqual(niceScale(4899));
    });

    it.each([1, 2, 7, 99, 100, 101, 999, 1001, 2499, 2501, 4899, 33_333, 99_999, 123_456, 7_654_321, 99_999_999_999])(
        'has 3 to 5 evenly spaced round ticks from 0 to a top that holds %i, at most twice as high',
        (value) => {
            const { max, step, ticks } = niceScale(value);

            expect(ticks.length).toBeGreaterThanOrEqual(3);
            expect(ticks.length).toBeLessThanOrEqual(5);
            expect(ticks[0]).toBe(0);
            expect(ticks.at(-1)).toBe(max);
            expect(ticks.every((tick, index) => tick === index * step)).toBe(true);
            expect(Number.isInteger(step)).toBe(true);
            expect([1, 2, 2.5, 5]).toContain(step / 10 ** Math.floor(Math.log10(step)));
            expect(max).toBeGreaterThanOrEqual(value);
            expect(max).toBeLessThanOrEqual(2 * value);
        }
    );
});

describe('previousRange', () => {
    it('is the day before a single day', () => {
        expect(previousRange('day', { from: '2026-10-25', to: '2026-10-25' })).toEqual({
            from: '2026-10-24',
            to: '2026-10-24',
        });
    });

    it('is as many days again for days, not the month before', () => {
        expect(previousRange('day', { from: '2026-10-01', to: '2026-10-31' })).toEqual({
            from: '2026-08-31',
            to: '2026-09-30',
        });
    });

    it('goes back over a New Year', () => {
        expect(previousRange('day', { from: '2026-01-01', to: '2026-01-31' })).toEqual({
            from: '2025-12-01',
            to: '2025-12-31',
        });
        expect(previousRange('month', { from: '2026-01-01', to: '2026-03-31' })).toEqual({
            from: '2025-10-01',
            to: '2025-12-31',
        });
        expect(previousRange('week', { from: '2026-01-05', to: '2026-01-18' })).toEqual({
            from: '2025-12-22',
            to: '2026-01-04',
        });
    });

    it('counts a leap day like any other', () => {
        expect(previousRange('day', { from: '2024-03-01', to: '2024-03-31' })).toEqual({
            from: '2024-01-30',
            to: '2024-02-29',
        });
        expect(previousRange('day', { from: '2024-02-29', to: '2024-03-01' })).toEqual({
            from: '2024-02-27',
            to: '2024-02-28',
        });
        expect(previousRange('month', { from: '2024-03-01', to: '2024-03-31' })).toEqual({
            from: '2024-02-01',
            to: '2024-02-29',
        });
    });

    it('is as many whole weeks again, from Monday, for weeks', () => {
        expect(previousRange('week', { from: '2026-08-03', to: '2026-10-25' })).toEqual({
            from: '2026-05-11',
            to: '2026-08-02',
        });
    });

    it('is as many whole months again for months', () => {
        expect(previousRange('month', { from: '2025-11-01', to: '2026-10-31' })).toEqual({
            from: '2024-11-01',
            to: '2025-10-31',
        });
    });

    it('ends the day before the first row of a range that does not start on one', () => {
        expect(previousRange('week', { from: '2026-10-07', to: '2026-10-25' })).toEqual({
            from: '2026-09-14',
            to: '2026-10-04',
        });
        expect(previousRange('month', { from: '2026-08-15', to: '2026-10-20' })).toEqual({
            from: '2026-05-01',
            to: '2026-07-31',
        });
        expect(previousRange('day', { from: '2026-10-07', to: '2026-10-25' })).toEqual({
            from: '2026-09-18',
            to: '2026-10-06',
        });
    });

    it.each(['day', 'week', 'month'] as const)('makes as many %s rows, right before the first one', (granularity) => {
        const range = { from: '2026-03-17', to: '2026-10-25' };

        const previous = previousRange(granularity, range);

        expect(bucketCount(granularity, previous)).toBe(bucketCount(granularity, range));
        expect(addDays(previous.to, 1)).toBe(bucketStart(range.from, granularity));
        expect(bucketStart(previous.from, granularity)).toBe(previous.from);
    });
});

describe('comparison', () => {
    it('compares a range of whole rows that has ended with as many rows before it', () => {
        expect(comparison('month', { from: '2026-10-01', to: '2026-10-31' }, '2026-11-05')).toEqual({
            current: { from: '2026-10-01', to: '2026-10-31' },
            previous: { from: '2026-09-01', to: '2026-09-30' },
        });
        expect(comparison('week', { from: '2026-08-03', to: '2026-10-25' }, '2026-10-25')).toEqual({
            current: { from: '2026-08-03', to: '2026-10-25' },
            previous: { from: '2026-05-11', to: '2026-08-02' },
        });
        expect(comparison('day', { from: '2026-10-07', to: '2026-10-25' }, '2026-10-26')).toEqual({
            current: { from: '2026-10-07', to: '2026-10-25' },
            previous: { from: '2026-09-18', to: '2026-10-06' },
        });
    });

    it('compares a range that is not whole rows with as many days before it', () => {
        expect(comparison('month', { from: '2026-10-15', to: '2026-10-31' }, '2026-11-05')).toEqual({
            current: { from: '2026-10-15', to: '2026-10-31' },
            previous: { from: '2026-09-28', to: '2026-10-14' },
        });
        expect(comparison('week', { from: '2026-10-07', to: '2026-10-25' }, '2026-10-30')).toEqual({
            current: { from: '2026-10-07', to: '2026-10-25' },
            previous: { from: '2026-09-18', to: '2026-10-06' },
        });
        expect(comparison('month', { from: '2026-09-01', to: '2026-10-20' }, '2026-10-30')).toEqual({
            current: { from: '2026-09-01', to: '2026-10-20' },
            previous: { from: '2026-07-13', to: '2026-08-31' },
        });
    });

    it('compares a range still running up to today with as many days before its start', () => {
        expect(comparison('day', { from: '2026-10-01', to: '2026-10-31' }, '2026-10-03')).toEqual({
            current: { from: '2026-10-01', to: '2026-10-03' },
            previous: { from: '2026-09-28', to: '2026-09-30' },
        });
        expect(comparison('month', { from: '2025-11-01', to: '2026-10-31' }, '2026-10-25')).toEqual({
            current: { from: '2025-11-01', to: '2026-10-25' },
            previous: { from: '2024-11-07', to: '2025-10-31' },
        });
    });

    it('compares the first day of a running range with the day before it', () => {
        expect(comparison('week', { from: '2026-10-26', to: '2026-11-01' }, '2026-10-26')).toEqual({
            current: { from: '2026-10-26', to: '2026-10-26' },
            previous: { from: '2026-10-25', to: '2026-10-25' },
        });
    });

    it('treats a range that ends today as ended', () => {
        expect(comparison('day', { from: '2026-10-25', to: '2026-10-25' }, '2026-10-25')).toEqual({
            current: { from: '2026-10-25', to: '2026-10-25' },
            previous: { from: '2026-10-24', to: '2026-10-24' },
        });
    });

    it('has nothing to compare for a range that starts after today, or ends before it begins', () => {
        expect(comparison('day', { from: '2026-11-01', to: '2026-11-30' }, '2026-10-25')).toBeNull();
        expect(comparison('day', { from: '2026-10-25', to: '2026-10-24' }, '2026-10-30')).toBeNull();
    });

    it('counts a leap day like any other', () => {
        expect(comparison('day', { from: '2024-03-01', to: '2024-03-31' }, '2024-03-02')).toEqual({
            current: { from: '2024-03-01', to: '2024-03-02' },
            previous: { from: '2024-02-28', to: '2024-02-29' },
        });
        expect(comparison('month', { from: '2024-03-01', to: '2024-03-31' }, '2024-04-10')).toEqual({
            current: { from: '2024-03-01', to: '2024-03-31' },
            previous: { from: '2024-02-01', to: '2024-02-29' },
        });
    });

    it('goes back over a New Year', () => {
        expect(comparison('day', { from: '2026-01-01', to: '2026-01-31' }, '2026-01-02')).toEqual({
            current: { from: '2026-01-01', to: '2026-01-02' },
            previous: { from: '2025-12-30', to: '2025-12-31' },
        });
        expect(comparison('month', { from: '2026-01-01', to: '2026-03-31' }, '2026-04-01')).toEqual({
            current: { from: '2026-01-01', to: '2026-03-31' },
            previous: { from: '2025-10-01', to: '2025-12-31' },
        });
    });

    it.each(['day', 'week', 'month'] as const)(
        'compares spans of the same number of days whenever the %s range is not whole rows that have ended',
        (granularity) => {
            const range = { from: '2026-03-17', to: '2026-10-31' };

            const compared = comparison(granularity, range, '2026-10-20')!;

            expect(daysBetween(compared.previous.from, compared.previous.to)).toBe(
                daysBetween(compared.current.from, compared.current.to)
            );
            expect(addDays(compared.previous.to, 1)).toBe(compared.current.from);
        }
    );
});
