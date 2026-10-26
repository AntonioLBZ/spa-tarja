import { describe, expect, it } from 'vitest';

import { applyPending, upsertById } from './expense-merge';

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

describe('upsertById', () => {
    it('replaces the expense with the same id in place', () => {
        const result = upsertById([expense('a'), expense('b')], expense('a', { text: 'changed' }));

        expect(result.map((item) => item.text)).toEqual(['changed', 'b']);
    });

    it('appends an expense it has not seen', () => {
        expect(upsertById([expense('a')], expense('b')).map((item) => item.id)).toEqual(['a', 'b']);
    });

    it('does not modify its input', () => {
        const input = [expense('a')];

        upsertById(input, expense('a', { text: 'changed' }));

        expect(input[0]?.text).toBe('a');
    });
});

describe('applyPending', () => {
    it('shows a pending version over the one from the server, even when the server one is newer', () => {
        const result = applyPending(
            [expense('a', { text: 'server', updatedAt: 9 })],
            [expense('a', { text: 'local' })]
        );

        expect(result.map((item) => item.text)).toEqual(['local']);
    });

    it('adds pending expenses the server has not seen yet', () => {
        const result = applyPending([expense('a')], [expense('b')]);

        expect(result.map((item) => item.id)).toEqual(['a', 'b']);
    });

    it('keeps a pending delete, so the row can be hidden', () => {
        const result = applyPending([expense('a')], [expense('a', { deletedAt: 5 })]);

        expect(result[0]?.deletedAt).toBe(5);
    });

    it('shows the pending version whole, your part of a restaurant card included', () => {
        const voucher = { amountCents: 4000, payment: 'voucher', chargeDate: '2026-11-12' } as const;
        const server = [expense('a', { ...voucher, personalCents: 2000 })];

        expect(applyPending(server, [expense('a', { ...voucher, personalCents: 1500 })])[0]?.personalCents).toBe(1500);
        expect(applyPending(server, [expense('a', voucher)])[0]).not.toHaveProperty('personalCents');
    });

    it('returns the server expenses untouched when nothing is pending', () => {
        const server = [expense('a'), expense('b')];

        expect(applyPending(server, [])).toEqual(server);
    });
});
