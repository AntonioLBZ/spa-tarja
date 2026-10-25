import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { expenseInputSchema } from './expense';

const lunch = {
    categoryId: 'food',
    text: 'Lunch',
    amountCents: 1250,
    currency: 'EUR',
    date: '2026-10-25',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
};

function parse(overrides: Record<string, unknown> = {}) {
    return v.safeParse(expenseInputSchema, { ...lunch, ...overrides });
}

describe('expenseInputSchema', () => {
    it('accepts an expense that says nothing about when it is charged, as older clients write it', () => {
        const result = parse();

        expect(result.success).toBe(true);
        expect(result.output).toEqual(lunch);
    });

    it('accepts a direct expense with no charge date', () => {
        expect(parse({ payment: 'direct', chargeDate: null }).success).toBe(true);
    });

    it.each(['credit', 'voucher'])('accepts a %s expense charged on a later day', (payment) => {
        const result = parse({ payment, chargeDate: '2026-11-25' });

        expect(result.success).toBe(true);
        expect(result.output).toMatchObject({ payment, chargeDate: '2026-11-25' });
    });

    it('accepts a charge on the very day of the expense', () => {
        expect(parse({ payment: 'credit', chargeDate: '2026-10-25' }).success).toBe(true);
    });

    it.each(['credit', 'voucher'])('rejects a %s expense with no charge date', (payment) => {
        expect(parse({ payment }).success).toBe(false);
        expect(parse({ payment, chargeDate: null }).success).toBe(false);
    });

    it('rejects a charge date before the expense', () => {
        expect(parse({ payment: 'credit', chargeDate: '2026-10-24' }).success).toBe(false);
        expect(parse({ chargeDate: '2026-10-24' }).success).toBe(false);
    });

    it.each([
        ['an unknown payment', { payment: 'cash' }],
        ['a charge date that is not a day', { payment: 'credit', chargeDate: '2026-02-30' }],
        ['a malformed charge date', { payment: 'credit', chargeDate: '25/11/2026' }],
        ['a charge date that is not a string', { payment: 'credit', chargeDate: 20261125 }],
    ])('rejects %s', (_name, overrides) => {
        expect(parse(overrides).success).toBe(false);
    });
});
