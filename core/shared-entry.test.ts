import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { MAX_AMOUNT_CENTS } from './money';
import { sharedEntryInputSchema } from './shared-entry';

const ANA = '6a1f4c2e-8b3d-4e5f-9a7b-1c2d3e4f5a6b';
const BRUNO = '7b2e5d3f-9c4e-4f6a-8b8c-2d3e4f5a6b7c';
const CARLA = '8c3f6e4a-ad5f-4a7b-9c9d-3e4f5a6b7c8d';

const dinner = {
    kind: 'expense',
    text: 'Dinner',
    categoryId: 'food',
    amountCents: 3000,
    currency: 'EUR',
    date: '2026-10-25',
    paidBy: ANA,
    split: 'equal',
    shares: [
        { memberId: ANA, cents: 1500 },
        { memberId: BRUNO, cents: 1500 },
    ],
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
};

const payment = {
    kind: 'settlement',
    text: '',
    amountCents: 2000,
    currency: 'EUR',
    date: '2026-10-26',
    paidBy: BRUNO,
    shares: [{ memberId: ANA, cents: 2000 }],
    createdAt: 2,
    updatedAt: 2,
    deletedAt: null,
};

function parse(entry: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
    return v.safeParse(sharedEntryInputSchema, { ...entry, ...overrides });
}

describe('sharedEntryInputSchema', () => {
    describe('an expense', () => {
        it('is paid now and has no charge date when it says nothing about them', () => {
            const result = parse(dinner);

            expect(result.success).toBe(true);
            expect(result.output).toEqual({ ...dinner, payment: 'direct', chargeDate: null });
        });

        it.each(['credit', 'voucher'])('accepts a %s card of the payer, charged that day or later', (card) => {
            expect(parse(dinner, { payment: card, chargeDate: '2026-10-25' }).success).toBe(true);
            expect(parse(dinner, { payment: card, chargeDate: '2026-11-25' }).output).toMatchObject({
                payment: card,
                chargeDate: '2026-11-25',
            });
        });

        it('accepts a payer who paid for the others and has no share', () => {
            expect(parse(dinner, { shares: [{ memberId: BRUNO, cents: 3000 }] }).success).toBe(true);
        });

        it.each(['equal', 'percent', 'exact'])('keeps the split %s', (split) => {
            expect(parse(dinner, { split }).output).toMatchObject({ split });
        });

        it('accepts a share of a single cent', () => {
            const shares = [
                { memberId: ANA, cents: 2998 },
                { memberId: BRUNO, cents: 1 },
                { memberId: CARLA, cents: 1 },
            ];

            expect(parse(dinner, { shares }).success).toBe(true);
        });

        it.each([
            ['shares a cent short of the amount', { shares: [{ memberId: ANA, cents: 2999 }] }],
            [
                'shares a cent over the amount',
                {
                    shares: [
                        { memberId: ANA, cents: 1501 },
                        { memberId: BRUNO, cents: 1500 },
                    ],
                },
            ],
            [
                'a share of nothing',
                {
                    shares: [
                        { memberId: ANA, cents: 3000 },
                        { memberId: BRUNO, cents: 0 },
                    ],
                },
            ],
            [
                'a negative share',
                {
                    shares: [
                        { memberId: ANA, cents: 3100 },
                        { memberId: BRUNO, cents: -100 },
                    ],
                },
            ],
            [
                'a fractional share',
                {
                    shares: [
                        { memberId: ANA, cents: 1500.5 },
                        { memberId: BRUNO, cents: 1499.5 },
                    ],
                },
            ],
            [
                'a member with two shares',
                {
                    shares: [
                        { memberId: ANA, cents: 1500 },
                        { memberId: ANA, cents: 1500 },
                    ],
                },
            ],
            ['no shares', { shares: [] }],
            ['a member id that is not a UUID', { shares: [{ memberId: 'ana', cents: 3000 }] }],
            ['a payer id that is not a UUID', { paidBy: 'ana' }],
            ['an amount of nothing', { amountCents: 0, shares: [] }],
            ['an amount over the maximum', { amountCents: MAX_AMOUNT_CENTS + 1 }],
            ['no category', { categoryId: undefined }],
            ['a null category', { categoryId: null }],
            ['an empty category', { categoryId: '' }],
            ['an unknown split', { split: 'shares' }],
            ['no split', { split: undefined }],
            ['an unknown payment', { payment: 'cash' }],
            ['a credit card with no charge date', { payment: 'credit' }],
            ['a restaurant card with no charge date', { payment: 'voucher', chargeDate: null }],
            ['a charge before the day it was made', { payment: 'credit', chargeDate: '2026-10-24' }],
            ['a charge date on an expense paid now', { payment: 'direct', chargeDate: '2026-11-25' }],
            [
                'a card of a payer who has no share',
                { payment: 'credit', chargeDate: '2026-11-25', shares: [{ memberId: BRUNO, cents: 3000 }] },
            ],
            ['a text over 200 characters', { text: 'x'.repeat(201) }],
            ['a currency that is not a code', { currency: 'euro' }],
            ['a day that does not exist', { date: '2026-02-30' }],
            ['an unknown kind', { kind: 'refund' }],
        ])('rejects %s', (_name, overrides) => {
            expect(parse(dinner, overrides).success).toBe(false);
        });

        it('takes any category id of the right shape, leaving the default ones to be checked apart', () => {
            expect(parse(dinner, { categoryId: crypto.randomUUID() }).success).toBe(true);
        });
    });

    describe('a settlement', () => {
        it('has no category, is split exactly, paid now and never charged later', () => {
            const result = parse(payment);

            expect(result.success).toBe(true);
            expect(result.output).toEqual({
                ...payment,
                categoryId: null,
                split: 'exact',
                payment: 'direct',
                chargeDate: null,
            });
        });

        it('accepts what it fills in itself, so a stored one parses again', () => {
            const stored = v.parse(sharedEntryInputSchema, payment);

            expect(parse(stored).output).toEqual(stored);
        });

        it('accepts a single cent, and more than any debt', () => {
            expect(parse(payment, { amountCents: 1, shares: [{ memberId: ANA, cents: 1 }] }).success).toBe(true);
            expect(
                parse(payment, { amountCents: MAX_AMOUNT_CENTS, shares: [{ memberId: ANA, cents: MAX_AMOUNT_CENTS }] })
                    .success
            ).toBe(true);
        });

        it.each([
            ['nothing paid', { amountCents: 0, shares: [{ memberId: ANA, cents: 0 }] }],
            ['a negative amount', { amountCents: -2000, shares: [{ memberId: ANA, cents: -2000 }] }],
            ['a category', { categoryId: 'food' }],
            [
                'two receivers',
                {
                    shares: [
                        { memberId: ANA, cents: 1000 },
                        { memberId: CARLA, cents: 1000 },
                    ],
                },
            ],
            ['no receiver', { shares: [] }],
            ['a receiver who is the payer', { shares: [{ memberId: BRUNO, cents: 2000 }] }],
            ['a share that is not the amount', { shares: [{ memberId: ANA, cents: 1999 }] }],
            ['a card', { payment: 'credit', chargeDate: '2026-11-26' }],
            ['a charge date', { chargeDate: '2026-11-26' }],
            ['a split other than exact', { split: 'equal' }],
        ])('rejects %s', (_name, overrides) => {
            expect(parse(payment, overrides).success).toBe(false);
        });
    });
});
