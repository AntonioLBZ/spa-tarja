import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { incomeInputSchema, monthSchema } from './income';
import { MAX_AMOUNT_CENTS } from './money';

describe('monthSchema', () => {
    it('takes a month and nothing else', () => {
        expect(v.is(monthSchema, '2026-10')).toBe(true);
        expect(v.is(monthSchema, '2026-13')).toBe(false);
        expect(v.is(monthSchema, '2026-10-01')).toBe(false);
        expect(v.is(monthSchema, 202610)).toBe(false);
    });
});

describe('incomeInputSchema', () => {
    const valid = { amountCents: 200_000, currency: 'EUR' };

    it('takes an amount in cents and a currency', () => {
        expect(v.is(incomeInputSchema, valid)).toBe(true);
        expect(v.is(incomeInputSchema, { ...valid, amountCents: 1 })).toBe(true);
        expect(v.is(incomeInputSchema, { ...valid, amountCents: MAX_AMOUNT_CENTS })).toBe(true);
    });

    it.each([
        ['no amount', { currency: 'EUR' }],
        ['no currency', { amountCents: 100 }],
        ['an amount of zero', { ...valid, amountCents: 0 }],
        ['a negative amount', { ...valid, amountCents: -5 }],
        ['an amount with decimals', { ...valid, amountCents: 10.5 }],
        ['an amount that is not a number', { ...valid, amountCents: '100' }],
        ['an amount too large to be stored safely', { ...valid, amountCents: MAX_AMOUNT_CENTS + 1 }],
        ['a currency that is not three capital letters', { ...valid, currency: 'eur' }],
    ])('rejects %s', (_, input) => {
        expect(v.is(incomeInputSchema, input)).toBe(false);
    });
});
