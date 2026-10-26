import { describe, expect, it } from 'vitest';

import { summarizeMonth } from './summary';

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

describe('summarizeMonth', () => {
    it('adds up what counts in the month, whichever category it has', () => {
        const summary = summarizeMonth(
            '2026-10',
            [expense({ amountCents: 1000 }), expense({ amountCents: 250, categoryId: 'leisure' })],
            null
        );

        expect(summary.spentCents).toBe(1250);
    });

    it('leaves out other months and deleted expenses', () => {
        const summary = summarizeMonth(
            '2026-10',
            [
                expense({ amountCents: 1000 }),
                expense({ amountCents: 100, date: '2026-09-30' }),
                expense({ amountCents: 100, date: '2026-11-01' }),
                expense({ amountCents: 100, deletedAt: 5 }),
            ],
            null
        );

        expect(summary.spentCents).toBe(1000);
    });

    it('counts a deferred expense in the month it is charged, not the month it was made', () => {
        const credit = expense({ amountCents: 4000, date: '2026-09-28', payment: 'credit', chargeDate: '2026-10-05' });

        expect(summarizeMonth('2026-10', [credit], null).spentCents).toBe(4000);
        expect(summarizeMonth('2026-09', [credit], null).spentCents).toBe(0);
    });

    it('counts each part of a plan in its own month', () => {
        const plan = crypto.randomUUID();
        const parts = ['2026-10-25', '2026-11-25', '2026-12-25'].map((chargeDate, index) =>
            expense({
                amountCents: 500 + index,
                payment: 'direct',
                chargeDate,
                plan: { id: plan, part: index + 1, parts: 3 },
            })
        );

        expect(summarizeMonth('2026-10', parts, null).spentCents).toBe(500);
        expect(summarizeMonth('2026-11', parts, null).spentCents).toBe(501);
        expect(summarizeMonth('2026-12', parts, null).spentCents).toBe(502);
    });

    it('counts an older restaurant card expense in full: spent the month it was made, income the month charged', () => {
        const voucher = expense({
            amountCents: 1800,
            date: '2026-09-20',
            payment: 'voucher',
            chargeDate: '2026-10-05',
        });

        const september = summarizeMonth('2026-09', [voucher], null);
        const october = summarizeMonth('2026-10', [voucher, expense({ amountCents: 1000 })], null);

        expect(september).toMatchObject({ spentCents: 1800, voucherCents: 0, paidBackCents: 0 });
        expect(october).toMatchObject({ spentCents: 1000, voucherCents: 1800, paidBackCents: 0 });
    });

    it('counts the restaurant card income of every expense charged in the month, on its first day', () => {
        const charged = (date: string, chargeDate: string, amountCents: number) =>
            expense({ amountCents, date, payment: 'voucher', chargeDate });

        const summary = summarizeMonth(
            '2026-11',
            [
                charged('2026-10-12', '2026-11-01', 100),
                charged('2026-10-31', '2026-11-30', 200),
                charged('2026-10-30', '2026-10-31', 400),
                charged('2026-11-02', '2026-12-01', 800),
            ],
            null
        );

        expect(summary.voucherCents).toBe(300);
    });

    it('leaves deleted restaurant card expenses out of the income and of what was paid back', () => {
        const deleted = expense({
            amountCents: 4000,
            personalCents: 1000,
            date: '2026-10-12',
            payment: 'voucher',
            chargeDate: '2026-10-20',
            deletedAt: 5,
        });

        expect(summarizeMonth('2026-10', [deleted], null)).toMatchObject({
            spentCents: 0,
            voucherCents: 0,
            paidBackCents: 0,
        });
    });

    it('has no restaurant card income, and nothing paid back, when nothing was paid that way', () => {
        const summary = summarizeMonth(
            '2026-10',
            [expense(), expense({ payment: 'credit', chargeDate: '2026-10-30' })],
            null
        );

        expect(summary.voucherCents).toBe(0);
        expect(summary.paidBackCents).toBe(0);
    });

    it('leaves what is left of the income, with the restaurant card income on top of it', () => {
        const voucher = expense({ amountCents: 1800, payment: 'voucher', chargeDate: '2026-10-25' });

        const summary = summarizeMonth('2026-10', [voucher, expense({ amountCents: 1000 })], 200_000);

        expect(summary.incomeCents).toBe(200_000);
        expect(summary.leftCents).toBe(200_000 + 1800 - 2800);
    });

    it('leaves the income, plus the restaurant card and what others paid back, minus what was spent', () => {
        const shared = expense({
            amountCents: 3000,
            personalCents: 1000,
            date: '2026-10-03',
            payment: 'voucher',
            chargeDate: '2026-11-03',
        });
        const charged = expense({
            amountCents: 1800,
            date: '2026-09-20',
            payment: 'voucher',
            chargeDate: '2026-10-05',
        });

        const summary = summarizeMonth('2026-10', [shared, charged, expense({ amountCents: 500 })], 200_000);

        expect(summary).toMatchObject({ voucherCents: 1800, paidBackCents: 2000, spentCents: 1500 });
        expect(summary.leftCents).toBe(200_000 + 1800 + 2000 - 1500);
    });

    it('can leave less than nothing', () => {
        expect(summarizeMonth('2026-10', [expense({ amountCents: 5000 })], 3000).leftCents).toBe(-2000);
    });

    it('does not say what is left until the income is known', () => {
        const summary = summarizeMonth('2026-10', [expense()], null);

        expect(summary.incomeCents).toBeNull();
        expect(summary.leftCents).toBeNull();
    });

    it('is an empty month when there is nothing', () => {
        expect(summarizeMonth('2026-10', [], 100_000)).toEqual({
            month: '2026-10',
            incomeCents: 100_000,
            voucherCents: 0,
            paidBackCents: 0,
            spentCents: 0,
            leftCents: 100_000,
        });
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

    it('is, in October, 20 spent and 20 paid back by others, with no restaurant card income', () => {
        expect(summarizeMonth('2026-10', [dinner], 200_000)).toEqual({
            month: '2026-10',
            incomeCents: 200_000,
            voucherCents: 0,
            paidBackCents: 2000,
            spentCents: 2000,
            leftCents: 200_000,
        });
    });

    it('is, in November, 20 of restaurant card income and nothing spent', () => {
        expect(summarizeMonth('2026-11', [dinner], 200_000)).toEqual({
            month: '2026-11',
            incomeCents: 200_000,
            voucherCents: 2000,
            paidBackCents: 0,
            spentCents: 0,
            leftCents: 202_000,
        });
    });

    it('is nothing in September or in December', () => {
        for (const month of ['2026-09', '2026-12']) {
            expect(summarizeMonth(month, [dinner], null)).toMatchObject({
                voucherCents: 0,
                paidBackCents: 0,
                spentCents: 0,
            });
        }
    });
});
