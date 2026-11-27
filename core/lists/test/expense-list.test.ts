import { describe, expect, it } from 'vitest';

import { NO_FILTERS, buildList, isListGrouping, limitRows, listItems, listTable } from '@core/lists/expense-list';
import { ctx, expense, filters, plan } from '@core/testing/expense-list';

describe('listItems', () => {
    it('is empty without expenses', () => {
        expect(listItems([])).toEqual([]);
    });

    it('leaves deleted expenses out', () => {
        const items = listItems([expense('kept'), expense('gone', { deletedAt: 5 })]);

        expect(items).toEqual([{ kind: 'single', expense: expect.objectContaining({ id: 'kept' }) }]);
    });

    it('puts the newest day first and, within a day, the latest logged first', () => {
        const items = listItems([
            expense('old', { date: '2026-10-01', createdAt: 99 }),
            expense('first', { createdAt: 10 }),
            expense('third', { createdAt: 30 }),
            expense('second', { createdAt: 20 }),
        ]);

        expect(items.map((item) => (item.kind === 'single' ? item.expense.id : item.planId))).toEqual([
            'third',
            'second',
            'first',
            'old',
        ]);
    });

    it('turns the parts of a plan into one item, with the very parts it was given', () => {
        const parts = plan('sofa', 3);

        const items = listItems([expense('a', { createdAt: 5 }), ...parts.toReversed()]);

        const found = items.find((item) => item.kind === 'plan');
        expect(found?.kind === 'plan' && found.parts).toEqual(parts);
        expect(found?.kind === 'plan' && found.parts.every((one, index) => one === parts[index])).toBe(true);
        expect(items).toHaveLength(2);
    });

    it('does not modify its input', () => {
        const input = [expense('b', { date: '2026-10-02' }), expense('a', { date: '2026-10-03' })];

        listItems(input);

        expect(input.map((item) => item.id)).toEqual(['b', 'a']);
    });
});

describe('buildList grouped by day', () => {
    it('is empty without expenses', () => {
        expect(buildList([], NO_FILTERS, 'day', ctx)).toEqual([]);
    });

    it('groups the expenses of each day, newest day first, with the day as its key', () => {
        const groups = buildList(
            [expense('old', { date: '2026-10-01' }), expense('a'), expense('b')],
            NO_FILTERS,
            'day',
            ctx
        );

        expect(groups.map((group) => group.key)).toEqual(['2026-10-25', '2026-10-01']);
        expect(groups.map((group) => group.items.length)).toEqual([2, 1]);
    });

    it('drops a day that only had deleted expenses', () => {
        const groups = buildList(
            [expense('kept'), expense('only-deleted', { date: '2026-10-20', deletedAt: 5 })],
            NO_FILTERS,
            'day',
            ctx
        );

        expect(groups.map((group) => group.key)).toEqual(['2026-10-25']);
    });

    it('adds up what the rows show', () => {
        const groups = buildList(
            [
                expense('a', { amountCents: 250 }),
                expense('b', { amountCents: 1000 }),
                expense('c', { date: '2026-10-01' }),
            ],
            NO_FILTERS,
            'day',
            ctx
        );

        expect(groups.map((group) => group.totalCents)).toEqual([1250, 100]);
    });

    it('counts a plan once, at its full price, on the day it was bought', () => {
        const groups = buildList(
            [expense('lunch', { amountCents: 1000 }), ...plan('sofa', 3, { amountCents: 40_000 })],
            NO_FILTERS,
            'day',
            ctx
        );

        expect(groups).toHaveLength(1);
        expect(groups[0]?.items).toHaveLength(2);
        expect(groups[0]?.totalCents).toBe(1000 + 3 * 40_000);
    });

    it('counts a restaurant card expense at your part', () => {
        const groups = buildList(
            [
                expense('dinner', {
                    amountCents: 4000,
                    payment: 'voucher',
                    chargeDate: '2026-11-25',
                    personalCents: 1500,
                }),
                expense('lunch', { amountCents: 1000 }),
            ],
            NO_FILTERS,
            'day',
            ctx
        );

        expect(groups[0]?.totalCents).toBe(2500);
    });

    it('keeps a credit card expense on the day it was made', () => {
        const groups = buildList(
            [expense('tv', { amountCents: 30_000, payment: 'credit', chargeDate: '2026-12-05' })],
            NO_FILTERS,
            'day',
            ctx
        );

        expect(groups.map((group) => group.key)).toEqual(['2026-10-25']);
    });
});

describe('buildList grouped by week or month', () => {
    const days = [
        expense('sun', { date: '2026-10-25' }),
        expense('mon', { date: '2026-10-19' }),
        expense('before', { date: '2026-10-18' }),
        expense('september', { date: '2026-09-30' }),
    ];

    it('starts the week on Monday and names it by that Monday', () => {
        const groups = buildList(days, NO_FILTERS, 'week', ctx);

        expect(groups.map((group) => [group.key, group.items.length])).toEqual([
            ['2026-10-19', 2],
            ['2026-10-12', 1],
            ['2026-09-28', 1],
        ]);
    });

    it('starts the week on the day the context gives', () => {
        const groups = buildList(days, NO_FILTERS, 'week', { ...ctx, weekStart: 7 });

        expect(groups.map((group) => [group.key, group.items.length])).toEqual([
            ['2026-10-25', 1],
            ['2026-10-18', 2],
            ['2026-09-27', 1],
        ]);
    });

    it('names a week that crosses a New Year by its Monday, in the old year', () => {
        const groups = buildList(
            [
                expense('first-of-2026', { date: '2026-01-01' }),
                expense('monday', { date: '2025-12-29' }),
                expense('first-of-2027', { date: '2027-01-01' }),
                expense('sunday-of-2026', { date: '2027-01-03' }),
                expense('next-monday', { date: '2027-01-04' }),
            ],
            NO_FILTERS,
            'week',
            ctx
        );

        expect(groups.map((group) => [group.key, group.items.length])).toEqual([
            ['2027-01-04', 1],
            ['2026-12-28', 2],
            ['2025-12-29', 2],
        ]);
    });

    it('names a month by its first day, newest first', () => {
        const groups = buildList(days, NO_FILTERS, 'month', ctx);

        expect(groups.map((group) => [group.key, group.totalCents])).toEqual([
            ['2026-10-01', 300],
            ['2026-09-01', 100],
        ]);
    });

    it('counts a plan once in its week and its month, whatever its charge dates', () => {
        const groups = buildList(plan('sofa', 3, { amountCents: 100 }), NO_FILTERS, 'month', ctx);

        expect(groups).toHaveLength(1);
        expect(groups[0]?.totalCents).toBe(300);
    });

    it('sorts the groups newest first even when a plan arrives out of order', () => {
        const groups = buildList(
            [
                expense('b', { date: '2026-08-10' }),
                ...plan('sofa', 2, { date: '2026-10-02' }),
                expense('a', { date: '2026-09-10' }),
            ],
            NO_FILTERS,
            'month',
            ctx
        );

        expect(groups.map((group) => group.key)).toEqual(['2026-10-01', '2026-09-01', '2026-08-01']);
    });
});

describe('buildList grouped by category', () => {
    it('puts the biggest subtotal first', () => {
        const groups = buildList(
            [
                expense('a', { categoryId: 'leisure', amountCents: 500 }),
                expense('b', { categoryId: 'groceries', amountCents: 300 }),
                expense('c', { categoryId: 'food', amountCents: 900 }),
                expense('d', { categoryId: 'leisure', amountCents: 100 }),
            ],
            NO_FILTERS,
            'category',
            ctx
        );

        expect(groups.map((group) => [group.key, group.totalCents])).toEqual([
            ['food', 900],
            ['leisure', 600],
            ['groceries', 300],
        ]);
    });

    it('puts the lower id first when two subtotals tie', () => {
        const groups = buildList(
            [
                expense('a', { categoryId: 'leisure', amountCents: 500 }),
                expense('b', { categoryId: 'groceries', amountCents: 500 }),
                expense('c', { categoryId: 'food', amountCents: 500 }),
            ],
            NO_FILTERS,
            'category',
            ctx
        );

        expect(groups.map((group) => group.key)).toEqual(['food', 'groceries', 'leisure']);
    });

    it('lists the rows of a category newest first', () => {
        const groups = buildList(
            [expense('old', { date: '2026-10-01' }), expense('new', { date: '2026-10-20' })],
            NO_FILTERS,
            'category',
            ctx
        );

        expect(groups[0]?.items.map((item) => (item.kind === 'single' ? item.expense.id : ''))).toEqual(['new', 'old']);
    });

    it('files an expense whose category is gone under the fallback, without rewriting it', () => {
        const gone = expense('gone', { categoryId: 'deleted-uuid', amountCents: 700 });
        const groups = buildList(
            [gone, expense('other', { categoryId: 'other', amountCents: 300 })],
            NO_FILTERS,
            'category',
            ctx
        );

        expect(groups).toHaveLength(1);
        expect(groups[0]).toMatchObject({ key: 'other', totalCents: 1000 });
        expect(gone.categoryId).toBe('deleted-uuid');
        expect(groups[0]?.items.map((item) => (item.kind === 'single' ? item.expense.categoryId : ''))).toContain(
            'deleted-uuid'
        );
    });

    it('counts a plan once', () => {
        const groups = buildList(
            plan('sofa', 4, { categoryId: 'leisure', amountCents: 250 }),
            NO_FILTERS,
            'category',
            ctx
        );

        expect(groups).toEqual([
            { key: 'leisure', items: [expect.objectContaining({ kind: 'plan' })], totalCents: 1000 },
        ]);
    });
});

describe('isListGrouping', () => {
    it.each(['day', 'week', 'month', 'category'])('accepts %s', (value) => {
        expect(isListGrouping(value)).toBe(true);
    });

    it.each(['year', '', null, undefined, 3])('refuses %s', (value) => {
        expect(isListGrouping(value)).toBe(false);
    });
});

describe('limitRows', () => {
    const groups = buildList(
        [
            expense('a', { date: '2026-10-03', amountCents: 100 }),
            expense('b', { date: '2026-10-03', amountCents: 200, createdAt: 2 }),
            expense('c', { date: '2026-10-02', amountCents: 400 }),
            expense('d', { date: '2026-10-01', amountCents: 800 }),
        ],
        NO_FILTERS,
        'day',
        ctx
    );
    const rowIds = (limited: ReturnType<typeof limitRows>) =>
        limited.map((group) => group.items.map((item) => (item.kind === 'single' ? item.expense.id : item.planId)));

    it('keeps every group that fits', () => {
        expect(limitRows(groups, 10)).toEqual(groups);
    });

    it('cuts the rows past the limit, in the middle of a group if need be', () => {
        expect(rowIds(limitRows(groups, 1))).toEqual([['b']]);
        expect(rowIds(limitRows(groups, 3))).toEqual([['b', 'a'], ['c']]);
    });

    it('leaves out the groups that come after the limit', () => {
        expect(rowIds(limitRows(groups, 2))).toEqual([['b', 'a']]);
    });

    it('keeps the subtotal of a group that was cut whole', () => {
        expect(limitRows(groups, 1)[0]?.totalCents).toBe(300);
    });

    it('does not modify the groups it is given', () => {
        limitRows(groups, 1);

        expect(groups[0]?.items).toHaveLength(2);
    });

    it('counts a plan as one row', () => {
        const withPlan = buildList([...plan('sofa', 3), expense('lunch', { createdAt: 0 })], NO_FILTERS, 'day', ctx);

        expect(rowIds(limitRows(withPlan, 2))).toEqual([['sofa', 'lunch']]);
    });

    it('is empty for a limit of none', () => {
        expect(limitRows(groups, 0)).toEqual([]);
    });
});

describe('listTable', () => {
    const idsOf = (table: ReturnType<typeof listTable>) =>
        table.items.map((item) => (item.kind === 'plan' ? item.planId : item.expense.id));

    it('reads the rows of the list from the oldest, a day and then the moment it was logged', () => {
        const expenses = [
            expense('late', { date: '2026-10-26', createdAt: 1 }),
            expense('second', { date: '2026-10-25', createdAt: 2 }),
            expense('first', { date: '2026-10-25', createdAt: 1 }),
        ];

        expect(idsOf(listTable(listItems(expenses), NO_FILTERS, ctx))).toEqual(['first', 'second', 'late']);
    });

    it('keeps a plan as one row at its full price and adds up as the subtotals of the list', () => {
        const expenses = [
            ...plan('laptop', 3),
            expense('lunch', { amountCents: 1250, payment: 'voucher', personalCents: 800, date: '2026-10-26' }),
        ];
        const table = listTable(listItems(expenses), NO_FILTERS, ctx);

        expect(idsOf(table)).toEqual(['laptop', 'lunch']);
        expect(table.totalCents).toBe(1500 + 800);
        expect(table.totalCents).toBe(
            buildList(expenses, NO_FILTERS, 'day', ctx).reduce((sum, group) => sum + group.totalCents, 0)
        );
    });

    it('keeps only the rows the filters leave', () => {
        const expenses = [expense('lunch'), expense('cinema', { categoryId: 'leisure', amountCents: 900 })];
        const table = listTable(listItems(expenses), filters({ categoryId: 'leisure' }), ctx);

        expect(idsOf(table)).toEqual(['cinema']);
        expect(table.totalCents).toBe(900);
    });
});
