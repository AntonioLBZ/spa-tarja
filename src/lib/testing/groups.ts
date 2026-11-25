import { QueryClient, dehydrate } from '@tanstack/react-query';

import { GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { PERSIST_BUSTER, createPersister, createUserStorage, type PendingEntry } from '@/lib/offline';

import { TEST_USER } from './fake-auth';

import type { KeyValueStorage } from '@/lib/offline';
import type { SharedEntry } from '@core/shared-entry';
import type { GroupMember, SharedGroup } from '@core/shared-group';

type SharedExpense = Extract<SharedEntry, { kind: 'expense' }>;

const person = (name: string, overrides: Partial<GroupMember> = {}): GroupMember => {
    return {
        id: crypto.randomUUID(),
        name,
        role: 'member',
        claimed: true,
        leftAt: null,
        mergedInto: null,
        ...overrides,
    };
};

// An open group of the test user, Ana, who owns it, and Bea, with Show in my expenses on
const sampleGroup = (overrides: Partial<SharedGroup> = {}): SharedGroup => {
    const ana = person('Ana', { role: 'owner' });
    return {
        id: crypto.randomUUID(),
        kind: 'group',
        name: 'Trip',
        currency: 'EUR',
        simplifyDebts: false,
        closed: null,
        archived: false,
        me: ana.id,
        showInExpenses: true,
        pinnedAt: null,
        seq: 0,
        members: [ana, person('Bea')],
        ...overrides,
    };
};

// A dinner of €40.00 in the group, paid by the test user and split equally between the first two members
const sampleEntry = (group: SharedGroup, overrides: Partial<SharedExpense> = {}): PendingEntry => {
    return {
        id: crypto.randomUUID(),
        groupId: group.id,
        kind: 'expense',
        text: 'Dinner',
        categoryId: 'food',
        amountCents: 4000,
        currency: group.currency,
        date: '2026-10-25',
        paidBy: group.me,
        split: 'equal',
        shares: group.members.slice(0, 2).map((member) => ({ memberId: member.id, cents: 2000 })),
        payment: 'direct',
        chargeDate: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        ...overrides,
    };
};

// A settlement of the group: the first member paid the second the amount
const sampleSettlement = (group: SharedGroup, from: string, to: string, cents: number): PendingEntry => {
    return {
        id: crypto.randomUUID(),
        groupId: group.id,
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: cents,
        currency: group.currency,
        date: '2026-10-25',
        paidBy: from,
        split: 'exact',
        shares: [{ memberId: to, cents }],
        payment: 'direct',
        chargeDate: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
    };
};

// What the test user's device kept of the groups and their entries the last time it heard from the server
const leaveCopy = async (storage: KeyValueStorage, groups: SharedGroup[], entries: PendingEntry[]) => {
    const source = new QueryClient();
    source.setQueryData(GROUPS_KEY, groups);
    for (const item of groups) {
        const own = entries.filter((entry) => entry.groupId === item.id);
        source.setQueryData(groupEntriesKey(item.id), {
            entries: own.map((entry) => ({ ...entry, createdBy: item.me, updatedBy: item.me })),
            cursor: own.length,
        });
    }
    await createPersister(createUserStorage(storage, TEST_USER.id).storage).persistClient({
        timestamp: Date.now(),
        buster: PERSIST_BUSTER,
        clientState: dehydrate(source),
    });
};

export { leaveCopy, person, sampleEntry, sampleGroup, sampleSettlement };
