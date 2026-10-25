import { describe, expect, it } from 'vitest';

import { countedOn, paymentOf } from './counting';

import type { Expense } from './expense';

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: 'a',
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-10-25',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        ...overrides,
    };
}

describe('countedOn', () => {
    it('is the day it was made when nothing says otherwise', () => {
        expect(countedOn(expense())).toBe('2026-10-25');
        expect(countedOn(expense({ chargeDate: null }))).toBe('2026-10-25');
    });

    it('is the charge date when there is one', () => {
        expect(countedOn(expense({ payment: 'credit', chargeDate: '2026-11-05' }))).toBe('2026-11-05');
    });
});

describe('paymentOf', () => {
    it('is direct for an expense that never said', () => {
        expect(paymentOf(expense())).toBe('direct');
    });

    it('is what the expense says', () => {
        expect(paymentOf(expense({ payment: 'voucher', chargeDate: '2026-11-05' }))).toBe('voucher');
        expect(paymentOf(expense({ payment: 'credit', chargeDate: '2026-11-05' }))).toBe('credit');
    });
});
