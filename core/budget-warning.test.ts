import { describe, expect, it } from 'vitest';

import { TOTAL_SCOPE, type Budget } from './budget';
import { budgetWarning } from './budget-warning';

import type { Expense } from './expense';
import type { Income } from './income';

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

function budget(month: string, scope: string, amountCents: number): Budget {
    return { month, scope, amountCents, currency: 'EUR' };
}

function earning(month: string, amountCents: number): Income {
    return { month, amountCents, currency: 'EUR' };
}

const known = new Set(['food', 'leisure', 'other']);
const categoryOf = (categoryId: string) => (known.has(categoryId) ? categoryId : 'other');
const scopes = [TOTAL_SCOPE, 'food', 'leisure', 'other'];
const foodLimit = [budget('2026-10', 'food', 10_000)];

function warn(input: {
    before?: Expense[];
    added: Expense[];
    budgets?: Budget[];
    income?: Income[];
    scopes?: string[];
}) {
    return budgetWarning({
        before: input.before ?? [],
        added: input.added,
        budgets: input.budgets ?? [],
        income: input.income ?? [],
        scopes: input.scopes ?? scopes,
        categoryOf,
    });
}

describe('budgetWarning', () => {
    it('warns near when an expense takes a limit from under 80 % to 80 % or more', () => {
        const warning = warn({
            before: [expense({ amountCents: 7_000 })],
            added: [expense({ amountCents: 1_500 })],
            budgets: foodLimit,
        });

        expect(warning).toEqual({ kind: 'near', month: '2026-10', scope: 'food', percent: 85 });
    });

    it('warns over when an expense takes a limit from under 80 % past it', () => {
        const warning = warn({
            before: [expense({ amountCents: 5_000 })],
            added: [expense({ amountCents: 6_000 })],
            budgets: foodLimit,
        });

        expect(warning).toEqual({ kind: 'over', month: '2026-10', scope: 'food', percent: 110 });
    });

    it('warns over when an expense takes a limit from near to past it', () => {
        const warning = warn({
            before: [expense({ amountCents: 9_000 })],
            added: [expense({ amountCents: 2_000 })],
            budgets: foodLimit,
        });

        expect(warning).toMatchObject({ kind: 'over', percent: 110 });
    });

    it('does not warn again for a state the month was already in', () => {
        expect(
            warn({
                before: [expense({ amountCents: 8_500 })],
                added: [expense({ amountCents: 500 })],
                budgets: foodLimit,
            })
        ).toBeNull();
        expect(
            warn({
                before: [expense({ amountCents: 11_000 })],
                added: [expense({ amountCents: 500 })],
                budgets: foodLimit,
            })
        ).toBeNull();
    });

    it('does not warn while the use stays under 80 %', () => {
        expect(
            warn({
                before: [expense({ amountCents: 1_000 })],
                added: [expense({ amountCents: 1_000 })],
                budgets: foodLimit,
            })
        ).toBeNull();
    });

    it('does not warn without a limit', () => {
        expect(warn({ added: [expense({ amountCents: 99_999 })] })).toBeNull();
    });

    it('does not warn for a limit another category holds', () => {
        expect(
            warn({ added: [expense({ amountCents: 20_000, categoryId: 'leisure' })], budgets: foodLimit })
        ).toBeNull();
    });

    it('warns for the total as well', () => {
        const warning = warn({
            before: [expense({ amountCents: 4_000, categoryId: 'leisure' })],
            added: [expense({ amountCents: 2_000 })],
            budgets: [budget('2026-10', TOTAL_SCOPE, 5_000)],
        });

        expect(warning).toEqual({ kind: 'over', month: '2026-10', scope: TOTAL_SCOPE, percent: 120 });
    });

    it('holds a limit set in an earlier month', () => {
        const warning = warn({
            before: [expense({ amountCents: 9_000, date: '2026-11-03' })],
            added: [expense({ amountCents: 2_000, date: '2026-11-04' })],
            budgets: foodLimit,
        });

        expect(warning).toMatchObject({ kind: 'over', month: '2026-11' });
    });
});

describe('budgetWarning on the leftover', () => {
    const income = [earning('2026-10', 100_000)];

    it('warns negative when the leftover goes from zero or more to below zero', () => {
        const warning = warn({
            before: [expense({ amountCents: 90_000 })],
            added: [expense({ amountCents: 20_000 })],
            income,
        });

        expect(warning).toEqual({ kind: 'negative', month: '2026-10', scope: TOTAL_SCOPE, percent: null });
    });

    it('does not warn when the leftover is exactly zero', () => {
        expect(
            warn({ before: [expense({ amountCents: 90_000 })], added: [expense({ amountCents: 10_000 })], income })
        ).toBeNull();
    });

    it('does not warn when it was already below zero', () => {
        expect(
            warn({ before: [expense({ amountCents: 120_000 })], added: [expense({ amountCents: 1_000 })], income })
        ).toBeNull();
    });

    it('does not warn without an income for the month', () => {
        expect(
            warn({
                before: [expense({ amountCents: 90_000 })],
                added: [expense({ amountCents: 20_000 })],
                income: [earning('2026-09', 100_000)],
            })
        ).toBeNull();
    });
});

describe('budgetWarning when several things happen', () => {
    it('says the leftover first, then going over, then being near', () => {
        const income = [earning('2026-10', 10_000)];
        const budgets = [budget('2026-10', 'food', 10_000), budget('2026-10', TOTAL_SCOPE, 12_000)];

        expect(warn({ added: [expense({ amountCents: 11_000 })], budgets, income })?.kind).toBe('negative');
        expect(warn({ added: [expense({ amountCents: 11_000 })], budgets })?.kind).toBe('over');
        expect(warn({ added: [expense({ amountCents: 9_000 })], budgets })).toMatchObject({
            kind: 'near',
            scope: 'food',
        });
    });

    it('prefers going over a limit to being near another', () => {
        const budgets = [budget('2026-10', 'food', 10_000), budget('2026-10', TOTAL_SCOPE, 20_000)];

        const warning = warn({
            before: [expense({ amountCents: 6_000, categoryId: 'leisure' })],
            added: [expense({ amountCents: 11_000 })],
            budgets,
        });

        expect(warning).toMatchObject({ kind: 'over', scope: 'food' });
    });

    it('says the highest use first when the kind and the month tie', () => {
        const budgets = [budget('2026-10', TOTAL_SCOPE, 10_000), budget('2026-10', 'food', 12_000)];

        const warning = warn({ added: [expense({ amountCents: 15_000 })], budgets });

        expect(warning).toEqual({ kind: 'over', month: '2026-10', scope: TOTAL_SCOPE, percent: 150 });
    });

    it('says the earliest month when the kind ties', () => {
        const warning = warn({
            added: [expense({ amountCents: 11_000, date: '2026-11-02' }), expense({ amountCents: 11_000 })],
            budgets: foodLimit,
        });

        expect(warning).toMatchObject({ kind: 'over', month: '2026-10' });
    });
});

describe('budgetWarning for a month other than the one it was made in', () => {
    it('names the month a credit card expense is charged in', () => {
        const budgets = [budget('2026-11', 'food', 10_000)];

        const warning = warn({
            before: [expense({ amountCents: 7_000, date: '2026-11-05' })],
            added: [expense({ amountCents: 4_000, payment: 'credit', date: '2026-10-28', chargeDate: '2026-11-12' })],
            budgets,
        });

        expect(warning).toEqual({ kind: 'over', month: '2026-11', scope: 'food', percent: 110 });
    });

    it('does not count a credit card expense in the month it was made', () => {
        const warning = warn({
            added: [expense({ amountCents: 40_000, payment: 'credit', date: '2026-10-28', chargeDate: '2026-11-12' })],
            budgets: [budget('2026-10', 'food', 10_000), budget('2026-11', 'food', 0)],
        });

        expect(warning).toBeNull();
    });

    it('warns for the most serious of the parts of a plan, in whichever month it falls', () => {
        const plan = { id: crypto.randomUUID(), parts: 3 };
        const budgets = [budget('2026-10', 'food', 10_000)];

        const warning = warn({
            before: [
                expense({ amountCents: 5_000, date: '2026-11-03' }),
                expense({ amountCents: 9_000, date: '2026-12-03' }),
            ],
            added: [
                expense({ amountCents: 1_000, plan: { ...plan, part: 1 }, chargeDate: '2026-10-25' }),
                expense({ amountCents: 4_000, plan: { ...plan, part: 2 }, chargeDate: '2026-11-25' }),
                expense({ amountCents: 2_000, plan: { ...plan, part: 3 }, chargeDate: '2026-12-25' }),
            ],
            budgets,
        });

        expect(warning).toEqual({ kind: 'over', month: '2026-12', scope: 'food', percent: 110 });
    });

    it('counts an expense whose category no longer exists under Other', () => {
        const warning = warn({
            added: [expense({ amountCents: 9_000, categoryId: crypto.randomUUID() })],
            budgets: [budget('2026-10', 'other', 10_000)],
        });

        expect(warning).toEqual({ kind: 'near', month: '2026-10', scope: 'other', percent: 90 });
    });
});
