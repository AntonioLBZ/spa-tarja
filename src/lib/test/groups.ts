import type { PendingEntry } from '@/lib/offline';
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

export { person, sampleEntry, sampleGroup };
