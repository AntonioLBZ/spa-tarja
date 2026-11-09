import { afterEach, describe, expect, it, vi } from 'vitest';

import { sampleGroup } from '@/lib/test/groups';

import { newEntry, type EntryFields } from './new-entry';

afterEach(() => {
    vi.useRealTimers();
});

describe('a new entry of a group', () => {
    it('is made and written now in the currency of the group, not deleted, with the fields given', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(5_000);
        const group = sampleGroup({ currency: 'USD' });
        const [ana, bea] = group.members;

        const entry = newEntry(group, {
            kind: 'settlement',
            text: '',
            categoryId: null,
            amountCents: 1500,
            date: '2026-10-25',
            paidBy: ana!.id,
            split: 'exact',
            shares: [{ memberId: bea!.id, cents: 1500 }],
            payment: 'direct',
            chargeDate: null,
        });

        expect(entry).toEqual({
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            kind: 'settlement',
            text: '',
            categoryId: null,
            amountCents: 1500,
            currency: 'USD',
            date: '2026-10-25',
            paidBy: ana!.id,
            split: 'exact',
            shares: [{ memberId: bea!.id, cents: 1500 }],
            payment: 'direct',
            chargeDate: null,
            createdAt: 5_000,
            updatedAt: 5_000,
            deletedAt: null,
        });
    });

    it('has an id of its own each time', () => {
        const group = sampleGroup();
        const fields: EntryFields = {
            kind: 'expense',
            text: 'Dinner',
            categoryId: 'food',
            amountCents: 4000,
            date: '2026-10-25',
            paidBy: group.me,
            split: 'equal',
            shares: [{ memberId: group.me, cents: 4000 }],
            payment: 'direct',
            chargeDate: null,
        };

        expect(newEntry(group, fields).id).not.toBe(newEntry(group, fields).id);
    });
});
