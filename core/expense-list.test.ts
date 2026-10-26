import { describe, expect, it, vi } from 'vitest';

import { FALLBACK_CATEGORY_ID } from './categories';
import {
    NO_FILTERS,
    activeFilterCount,
    buildList,
    groupItems,
    hasFilters,
    isListGrouping,
    listItems,
    type ListContext,
    type ListFilters,
    type ListGrouping,
} from './expense-list';

import type { Expense } from './expense';

function expense(id: string, overrides: Partial<Expense> = {}): Expense {
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
        ...overrides,
    };
}

function plan(id: string, parts: number, overrides: Partial<Expense> = {}): Expense[] {
    return Array.from({ length: parts }, (_, index) =>
        expense(`${id}-${index + 1}`, {
            text: id,
            amountCents: 500,
            payment: 'direct',
            chargeDate: `2026-${String(10 + index)}-25`,
            plan: { id, part: index + 1, parts },
            ...overrides,
        })
    );
}

const NAMES: Record<string, string> = {
    food: 'Food',
    groceries: 'Groceries',
    leisure: 'Leisure',
    other: 'Other',
    custom: 'Coffee shops',
};

const ctx: ListContext = {
    categoryOf: (id) => (id in NAMES ? id : FALLBACK_CATEGORY_ID),
    labelOf: (id) => NAMES[id] ?? NAMES[FALLBACK_CATEGORY_ID]!,
};

function filters(overrides: Partial<ListFilters>): ListFilters {
    return { ...NO_FILTERS, ...overrides };
}

function ids(expenses: readonly Expense[], overrides: Partial<ListFilters> = {}, grouping: ListGrouping = 'day') {
    return buildList(expenses, filters(overrides), grouping, ctx).flatMap((group) =>
        group.items.map((item) => (item.kind === 'plan' ? item.planId : item.expense.id))
    );
}

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

describe('the text filter', () => {
    const list = [
        expense('cafe', { text: 'Café con leche' }),
        expense('shop', { text: 'Weekly shop', categoryId: 'groceries' }),
        expense('bar', { text: 'Beers with Ana', categoryId: 'leisure' }),
        expense('empty', { text: '', categoryId: 'custom' }),
    ];

    it('ignores case and accents on both sides', () => {
        expect(ids(list, { query: 'CAFE' })).toEqual(['cafe']);
        expect(ids([expense('a', { text: 'Cafe' })], { query: 'café' })).toEqual(['a']);
    });

    it('finds part of a word', () => {
        expect(ids(list, { query: 'wee' })).toEqual(['shop']);
    });

    it('needs every word, in any order', () => {
        expect(ids(list, { query: 'leche cafe' })).toEqual(['cafe']);
        expect(ids(list, { query: 'cafe shop' })).toEqual([]);
    });

    it('looks in the name of the category too', () => {
        expect(ids(list, { query: 'groceries' })).toEqual(['shop']);
        expect(ids(list, { query: 'weekly groceries' })).toEqual(['shop']);
        expect(ids(list, { query: 'coffee' })).toEqual(['empty']);
    });

    it('reads a category that is gone as the fallback, by its name', () => {
        expect(ids([expense('gone', { categoryId: 'deleted-uuid' })], { query: 'other' })).toEqual(['gone']);
    });

    it('does not let a word match across the description and the category', () => {
        expect(ids([expense('a', { text: 'Ho', categoryId: 'food' })], { query: 'hofood' })).toEqual([]);
    });

    it('shows everything for a blank query or one with only punctuation', () => {
        expect(ids(list, { query: '   ' })).toHaveLength(4);
        expect(ids(list, { query: '...' })).toHaveLength(4);
    });

    it('finds a plan once, by its description', () => {
        expect(ids([...plan('sofa', 3), expense('lunch')], { query: 'sofa' })).toEqual(['sofa']);
    });

    it('remembers what it read when given a cache', () => {
        const labelOf = vi.fn(ctx.labelOf);
        const cache = new WeakMap<Expense, string>();
        const cached: ListContext = { ...ctx, labelOf, searchTexts: cache };

        const first = buildList(list, filters({ query: 'cafe' }), 'day', cached);
        const second = buildList(list, filters({ query: 'leche' }), 'day', cached);

        expect(first).toHaveLength(1);
        expect(second).toHaveLength(1);
        expect(labelOf).toHaveBeenCalledTimes(list.length);
    });
});

describe('the category filter', () => {
    const list = [
        expense('food', { categoryId: 'food' }),
        expense('shop', { categoryId: 'groceries' }),
        expense('gone', { categoryId: 'deleted-uuid' }),
    ];

    it('keeps one category', () => {
        expect(ids(list, { categoryId: 'groceries' })).toEqual(['shop']);
    });

    it('counts an unknown category as Other, in the filter only', () => {
        expect(ids(list, { categoryId: 'other' })).toEqual(['gone']);
        expect(list[2]?.categoryId).toBe('deleted-uuid');
    });

    it('keeps a plan by its category', () => {
        expect(ids([...plan('sofa', 2, { categoryId: 'leisure' }), ...list], { categoryId: 'leisure' })).toEqual([
            'sofa',
        ]);
    });
});

describe('the date filter', () => {
    const list = [
        expense('a', { date: '2026-10-01' }),
        expense('b', { date: '2026-10-10' }),
        expense('c', { date: '2026-10-20' }),
    ];

    it('includes both ends', () => {
        expect(ids(list, { from: '2026-10-01', to: '2026-10-10' })).toEqual(['b', 'a']);
    });

    it('leaves an end open when it is empty', () => {
        expect(ids(list, { from: '2026-10-10' })).toEqual(['c', 'b']);
        expect(ids(list, { to: '2026-10-10' })).toEqual(['b', 'a']);
    });

    it('looks at the day made, not the day charged', () => {
        const card = expense('card', { date: '2026-10-05', payment: 'credit', chargeDate: '2026-11-05' });

        expect(ids([card], { from: '2026-10-01', to: '2026-10-31' })).toEqual(['card']);
        expect(ids([card], { from: '2026-11-01', to: '2026-11-30' })).toEqual([]);
    });

    it('is empty when the start is after the end', () => {
        expect(ids(list, { from: '2026-10-20', to: '2026-10-01' })).toEqual([]);
    });

    it('keeps a plan on its purchase day', () => {
        expect(ids(plan('sofa', 3), { from: '2026-10-25', to: '2026-10-25' })).toEqual(['sofa']);
        expect(ids(plan('sofa', 3), { from: '2026-11-01' })).toEqual([]);
    });
});

describe('the paid with filter', () => {
    const list = [
        expense('now', { payment: 'direct' }),
        expense('old'),
        expense('credit', { payment: 'credit', chargeDate: '2026-11-25' }),
        expense('voucher', { payment: 'voucher', chargeDate: '2026-11-25' }),
        ...plan('sofa', 3),
    ];

    it('keeps what was paid at once, old expenses with no payment included, but not a plan', () => {
        expect(ids(list, { paidWith: 'direct' }).toSorted()).toEqual(['now', 'old']);
    });

    it('keeps a credit card', () => {
        expect(ids(list, { paidWith: 'credit' })).toEqual(['credit']);
    });

    it('keeps a restaurant card', () => {
        expect(ids(list, { paidWith: 'voucher' })).toEqual(['voucher']);
    });

    it('keeps the plans', () => {
        expect(ids(list, { paidWith: 'plan' })).toEqual(['sofa']);
    });

    it('keeps everything for any', () => {
        expect(ids(list, { paidWith: 'any' })).toHaveLength(5);
    });
});

describe('filters together', () => {
    it('all have to hold', () => {
        const list = [
            expense('match', {
                text: 'Lunch with Ana',
                categoryId: 'food',
                date: '2026-10-10',
                payment: 'credit',
                chargeDate: '2026-11-10',
            }),
            expense('wrong-text', {
                text: 'Dinner',
                categoryId: 'food',
                date: '2026-10-10',
                payment: 'credit',
                chargeDate: '2026-11-10',
            }),
            expense('wrong-category', {
                text: 'Lunch with Ana',
                categoryId: 'leisure',
                date: '2026-10-10',
                payment: 'credit',
                chargeDate: '2026-11-10',
            }),
            expense('wrong-date', {
                text: 'Lunch with Ana',
                categoryId: 'food',
                date: '2026-09-10',
                payment: 'credit',
                chargeDate: '2026-11-10',
            }),
            expense('wrong-payment', { text: 'Lunch with Ana', categoryId: 'food', date: '2026-10-10' }),
        ];

        expect(
            ids(list, {
                query: 'lunch ana',
                categoryId: 'food',
                from: '2026-10-01',
                to: '2026-10-31',
                paidWith: 'credit',
            })
        ).toEqual(['match']);
    });

    it('filter before they group, so a group left empty is gone', () => {
        const list = [
            expense('a', { date: '2026-10-01', categoryId: 'food' }),
            expense('b', { date: '2026-10-02', categoryId: 'leisure' }),
        ];

        const groups = buildList(list, filters({ categoryId: 'leisure' }), 'day', ctx);

        expect(groups.map((group) => group.key)).toEqual(['2026-10-02']);
    });

    it('add up only the rows that are left', () => {
        const list = [
            expense('a', { amountCents: 400, categoryId: 'food' }),
            expense('b', { amountCents: 100, categoryId: 'leisure' }),
        ];

        expect(buildList(list, filters({ categoryId: 'leisure' }), 'day', ctx)[0]?.totalCents).toBe(100);
    });

    it('give groupItems the same answer as buildList', () => {
        const list = [expense('a', { text: 'Coffee' }), ...plan('sofa', 2), expense('b', { date: '2026-09-01' })];

        expect(groupItems(listItems(list), filters({ query: 'o' }), 'week', ctx)).toEqual(
            buildList(list, filters({ query: 'o' }), 'week', ctx)
        );
    });
});

describe('activeFilterCount and hasFilters', () => {
    it('count nothing for no filters', () => {
        expect(activeFilterCount(NO_FILTERS)).toBe(0);
        expect(hasFilters(NO_FILTERS)).toBe(false);
    });

    it('count the category, the dates and how it was paid, each once', () => {
        expect(activeFilterCount(filters({ categoryId: 'food' }))).toBe(1);
        expect(activeFilterCount(filters({ from: '2026-10-01', to: '2026-10-31' }))).toBe(1);
        expect(activeFilterCount(filters({ to: '2026-10-31' }))).toBe(1);
        expect(activeFilterCount(filters({ paidWith: 'credit' }))).toBe(1);
        expect(
            activeFilterCount(filters({ categoryId: 'food', from: '2026-10-01', paidWith: 'plan', query: 'x' }))
        ).toBe(3);
    });

    it('leave the search out of the count but not out of hasFilters', () => {
        expect(activeFilterCount(filters({ query: 'lunch' }))).toBe(0);
        expect(hasFilters(filters({ query: 'lunch' }))).toBe(true);
        expect(hasFilters(filters({ query: '  ..  ' }))).toBe(false);
        expect(hasFilters(filters({ paidWith: 'voucher' }))).toBe(true);
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
