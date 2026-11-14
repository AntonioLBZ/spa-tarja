import { describe, expect, it } from 'vitest';

import { noticeOf, noticesFor } from './notices';

import type { LedgerEntry } from './shared-entry';
import type { SharedMember } from './shared-member';

const members: SharedMember[] = [
    { id: 'ana', mergedInto: null },
    { id: 'bruno', mergedInto: null },
    { id: 'carla', mergedInto: null },
    { id: 'dummy', mergedInto: 'ana' },
];

const group = { id: 'trip', me: 'ana', members };

function expense(id: string, shares: Record<string, number>, overrides: Partial<LedgerEntry> = {}): LedgerEntry {
    const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
    return {
        id,
        kind: 'expense',
        text: 'Dinner',
        categoryId: 'food',
        amountCents: list.reduce((sum, share) => sum + share.cents, 0),
        currency: 'EUR',
        date: '2026-11-14',
        paidBy: 'bruno',
        split: 'exact',
        shares: list,
        payment: 'direct',
        chargeDate: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        createdBy: 'bruno',
        updatedBy: 'bruno',
        ...overrides,
    } as LedgerEntry;
}

function settlement(id: string, paidBy: string, to: string, createdBy: string | null = 'bruno'): LedgerEntry {
    return {
        id,
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: 2000,
        currency: 'EUR',
        date: '2026-11-14',
        paidBy,
        split: 'exact',
        shares: [{ memberId: to, cents: 2000 }],
        payment: 'direct',
        chargeDate: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        createdBy,
        updatedBy: createdBy,
    };
}

describe('noticeOf', () => {
    it('tells an expense with a share of the member that somebody else made, with their part', () => {
        expect(noticeOf(members, 'trip', expense('e1', { ana: 625, bruno: 625 }), 'ana')).toEqual({
            kind: 'expense',
            groupId: 'trip',
            entryId: 'e1',
            authorId: 'bruno',
            text: 'Dinner',
            currency: 'EUR',
            partCents: 625,
        });
    });

    it('tells nothing of an expense without a share of the member', () => {
        expect(noticeOf(members, 'trip', expense('e1', { bruno: 500, carla: 500 }), 'ana')).toBeNull();
    });

    it('tells nothing of what the member made, from any device', () => {
        expect(noticeOf(members, 'trip', expense('e1', { ana: 500 }, { createdBy: 'ana' }), 'ana')).toBeNull();
    });

    it('tells nothing of what a placeholder merged into the member made', () => {
        expect(noticeOf(members, 'trip', expense('e1', { ana: 500 }, { createdBy: 'dummy' }), 'ana')).toBeNull();
    });

    it('tells nothing of a deleted entry', () => {
        expect(noticeOf(members, 'trip', expense('e1', { ana: 500 }, { deletedAt: 2 }), 'ana')).toBeNull();
    });

    it('counts the share of a placeholder merged into the member as theirs', () => {
        const entry = expense('e1', { ana: 300, dummy: 200, bruno: 500 });

        expect(noticeOf(members, 'trip', entry, 'ana')).toMatchObject({ partCents: 500 });
    });

    it('tells an expense whose author deleted their account', () => {
        expect(noticeOf(members, 'trip', expense('e1', { ana: 500 }, { createdBy: null }), 'ana')).toMatchObject({
            authorId: null,
        });
    });

    it('tells a settlement the member is paid, with who paid them', () => {
        expect(noticeOf(members, 'trip', settlement('s1', 'bruno', 'ana'), 'ana')).toEqual({
            kind: 'settlement',
            groupId: 'trip',
            entryId: 's1',
            counterpartId: 'bruno',
            currency: 'EUR',
            amountCents: 2000,
            side: 'paid-you',
        });
    });

    it('tells a settlement the member paid, with whom they paid', () => {
        expect(noticeOf(members, 'trip', settlement('s1', 'dummy', 'bruno'), 'ana')).toMatchObject({
            counterpartId: 'bruno',
            side: 'you-paid',
        });
    });

    it('tells nothing of a settlement between two others', () => {
        expect(noticeOf(members, 'trip', settlement('s1', 'bruno', 'carla', 'carla'), 'ana')).toBeNull();
    });
});

describe('noticesFor', () => {
    const dinner = expense('e1', { ana: 500, bruno: 500 });
    const lunch = expense('e2', { ana: 300, bruno: 300 });

    it('tells nothing on the first pull of a group', () => {
        expect(noticesFor(group, undefined, [dinner, lunch])).toEqual([]);
    });

    it('tells the entries the device did not hold, and not a change of one it held', () => {
        const edited = { ...dinner, text: 'Supper', updatedAt: 2 };

        expect(noticesFor(group, [dinner], [edited, lunch]).map((notice) => notice.entryId)).toEqual(['e2']);
    });

    it('tells nothing of an entry made and deleted between two pulls', () => {
        expect(noticesFor(group, [dinner], [{ ...lunch, deletedAt: 2 }])).toEqual([]);
    });
});
