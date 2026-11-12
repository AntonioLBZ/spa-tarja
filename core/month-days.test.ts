import { describe, expect, it } from 'vitest';

import { daysInMonth, spentByDay } from './month-days';

import type { Expense } from './expense';

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1000,
        currency: 'EUR',
        date: '2026-11-09',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        ...overrides,
    };
}

describe('daysInMonth', () => {
    it('knows the length of any month, leap years included', () => {
        expect(daysInMonth('2026-11')).toBe(30);
        expect(daysInMonth('2026-12')).toBe(31);
        expect(daysInMonth('2026-02')).toBe(28);
        expect(daysInMonth('2028-02')).toBe(29);
    });
});

describe('spentByDay', () => {
    it('has one entry per day of the month, all zero when nothing was spent', () => {
        const days = spentByDay('2026-11', []);

        expect(days).toHaveLength(30);
        expect(days.every((cents) => cents === 0)).toBe(true);
    });

    it('adds up what counted on each day and nothing of other months', () => {
        const days = spentByDay('2026-11', [
            expense({ date: '2026-11-01', amountCents: 300 }),
            expense({ date: '2026-11-01', amountCents: 200 }),
            expense({ date: '2026-11-30', amountCents: 50 }),
            expense({ date: '2026-10-31', amountCents: 999 }),
        ]);

        expect(days[0]).toBe(500);
        expect(days[29]).toBe(50);
        expect(days.reduce((sum, cents) => sum + cents, 0)).toBe(550);
    });

    it('counts a deferred payment on the day it is charged and skips deleted expenses', () => {
        const days = spentByDay('2026-11', [
            expense({ date: '2026-10-28', chargeDate: '2026-11-03', payment: 'credit', amountCents: 700 }),
            expense({ date: '2026-11-05', amountCents: 400, deletedAt: 5 }),
        ]);

        expect(days[2]).toBe(700);
        expect(days[4]).toBe(0);
    });
});
