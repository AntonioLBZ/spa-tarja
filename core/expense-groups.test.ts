import { describe, expect, it } from 'vitest';

import { groupByDay } from './expense-groups';

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

describe('groupByDay', () => {
    it('is empty without expenses', () => {
        expect(groupByDay([])).toEqual([]);
    });

    it('puts the newest day first and groups the expenses of each day', () => {
        const groups = groupByDay([
            expense('old', { date: '2026-10-01' }),
            expense('a', { date: '2026-10-25' }),
            expense('b', { date: '2026-10-25' }),
        ]);

        expect(groups.map((group) => group.date)).toEqual(['2026-10-25', '2026-10-01']);
        expect(groups[0]?.expenses.map((item) => item.id)).toEqual(expect.arrayContaining(['a', 'b']));
        expect(groups[1]?.expenses.map((item) => item.id)).toEqual(['old']);
    });

    it('puts the latest logged expense first within a day', () => {
        const groups = groupByDay([
            expense('first', { createdAt: 10 }),
            expense('third', { createdAt: 30 }),
            expense('second', { createdAt: 20 }),
        ]);

        expect(groups[0]?.expenses.map((item) => item.id)).toEqual(['third', 'second', 'first']);
    });

    it('leaves deleted expenses out, and a day that only had those', () => {
        const groups = groupByDay([
            expense('kept', { date: '2026-10-25' }),
            expense('gone', { date: '2026-10-25', deletedAt: 5 }),
            expense('only-deleted', { date: '2026-10-20', deletedAt: 5 }),
        ]);

        expect(groups).toEqual([{ date: '2026-10-25', expenses: [expect.objectContaining({ id: 'kept' })] }]);
    });

    it('does not modify its input', () => {
        const input = [expense('b', { date: '2026-10-02' }), expense('a', { date: '2026-10-03' })];

        groupByDay(input);

        expect(input.map((item) => item.id)).toEqual(['b', 'a']);
    });
});
