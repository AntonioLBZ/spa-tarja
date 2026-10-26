import { describe, expect, it } from 'vitest';

import { countedCents, countedOn, paidBackCents, paymentOf, voucherIncomeOn } from './counting';

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

    it('is the charge date of a credit card expense', () => {
        expect(countedOn(expense({ payment: 'credit', chargeDate: '2026-11-05' }))).toBe('2026-11-05');
    });

    it('is the charge date of a part of a plan', () => {
        const plan = { id: crypto.randomUUID(), part: 2, parts: 3 };

        expect(countedOn(expense({ payment: 'direct', chargeDate: '2026-11-25', plan }))).toBe('2026-11-25');
    });

    it('is the day a restaurant card expense was made, whatever its charge date', () => {
        expect(countedOn(expense({ date: '2026-10-12', payment: 'voucher', chargeDate: '2026-11-12' }))).toBe(
            '2026-10-12'
        );
    });
});

describe('countedCents', () => {
    it('is the whole amount of an expense paid at once or with a credit card', () => {
        expect(countedCents(expense())).toBe(1250);
        expect(countedCents(expense({ payment: 'credit', chargeDate: '2026-11-05' }))).toBe(1250);
    });

    it('is your part of a restaurant card expense', () => {
        expect(countedCents(expense({ amountCents: 4000, personalCents: 2000, payment: 'voucher' }))).toBe(2000);
    });

    it('is the whole amount of a restaurant card expense that says nothing about your part', () => {
        expect(countedCents(expense({ amountCents: 4000, payment: 'voucher', chargeDate: '2026-11-12' }))).toBe(4000);
        expect(countedCents(expense({ amountCents: 4000, personalCents: null, payment: 'voucher' }))).toBe(4000);
    });

    it('is nothing when none of a restaurant card expense was yours', () => {
        expect(countedCents(expense({ amountCents: 4000, personalCents: 0, payment: 'voucher' }))).toBe(0);
    });

    it('ignores a part on any other payment', () => {
        expect(countedCents(expense({ amountCents: 4000, personalCents: 2000, payment: 'credit' }))).toBe(4000);
        expect(countedCents(expense({ amountCents: 4000, personalCents: 2000 }))).toBe(4000);
    });
});

describe('voucherIncomeOn', () => {
    it('is your part, on the first of the month it is charged', () => {
        expect(
            voucherIncomeOn(
                expense({
                    amountCents: 4000,
                    personalCents: 2000,
                    date: '2026-10-12',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                })
            )
        ).toEqual({ day: '2026-11-01', cents: 2000 });
    });

    it('is the whole amount when the expense says nothing about your part', () => {
        expect(
            voucherIncomeOn(
                expense({ amountCents: 1800, date: '2026-09-20', payment: 'voucher', chargeDate: '2026-10-05' })
            )
        ).toEqual({ day: '2026-10-01', cents: 1800 });
    });

    it('is on the first of the month it was made when there is no charge date', () => {
        expect(voucherIncomeOn(expense({ date: '2026-10-25', payment: 'voucher' }))).toEqual({
            day: '2026-10-01',
            cents: 1250,
        });
    });

    it('is none for any other payment', () => {
        expect(voucherIncomeOn(expense())).toBeNull();
        expect(voucherIncomeOn(expense({ payment: 'credit', chargeDate: '2026-11-05' }))).toBeNull();
    });
});

describe('paidBackCents', () => {
    it('is what the card paid beyond your part', () => {
        expect(paidBackCents(expense({ amountCents: 4000, personalCents: 1500, payment: 'voucher' }))).toBe(2500);
    });

    it('is the whole amount when none of it was yours', () => {
        expect(paidBackCents(expense({ amountCents: 4000, personalCents: 0, payment: 'voucher' }))).toBe(4000);
    });

    it('is nothing when the expense says nothing about your part, or your part is all of it', () => {
        expect(paidBackCents(expense({ amountCents: 4000, payment: 'voucher', chargeDate: '2026-11-12' }))).toBe(0);
        expect(paidBackCents(expense({ amountCents: 4000, personalCents: 4000, payment: 'voucher' }))).toBe(0);
    });

    it('is nothing for any other payment', () => {
        expect(paidBackCents(expense({ amountCents: 4000, personalCents: 1500, payment: 'credit' }))).toBe(0);
        expect(paidBackCents(expense())).toBe(0);
    });
});

describe('a dinner of 40 € on 12 October paid with the restaurant card, 20 € of it yours, charged on 12 November', () => {
    const dinner = expense({
        amountCents: 4000,
        personalCents: 2000,
        date: '2026-10-12',
        payment: 'voucher',
        chargeDate: '2026-11-12',
    });

    it('is 20 spent in October, on the day it was made', () => {
        expect(countedOn(dinner)).toBe('2026-10-12');
        expect(countedCents(dinner)).toBe(2000);
    });

    it('is 20 paid back by others in October, the rest of the 40', () => {
        expect(paidBackCents(dinner)).toBe(2000);
    });

    it('is 20 of restaurant card income in November, on the 1st and not on the 12th', () => {
        expect(voucherIncomeOn(dinner)).toEqual({ day: '2026-11-01', cents: 2000 });
    });
});

describe('a dinner of 40 € on 20 December paid with the restaurant card, 15 € of it yours, charged on 5 January', () => {
    const dinner = expense({
        amountCents: 4000,
        personalCents: 1500,
        date: '2026-12-20',
        payment: 'voucher',
        chargeDate: '2027-01-05',
    });

    it('is 15 of restaurant card income on 1 January, in the next year and not on the 5th', () => {
        expect(voucherIncomeOn(dinner)).toEqual({ day: '2027-01-01', cents: 1500 });
    });

    it('is 15 spent and 25 paid back in December, on the day it was made', () => {
        expect(countedOn(dinner)).toBe('2026-12-20');
        expect(countedCents(dinner)).toBe(1500);
        expect(paidBackCents(dinner)).toBe(2500);
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
