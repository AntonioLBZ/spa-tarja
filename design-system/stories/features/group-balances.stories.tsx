import { GroupBalances as GroupBalancesComponent } from '@/features/groups/group-balances';
import { groupDebts } from '@core/group-debts';
import { fn } from 'storybook/test';

import type { SharedEntry } from '@core/shared-entry';
import type { GroupMember, SharedGroup } from '@core/shared-group';
import type { Meta } from '@storybook/react-vite';

interface GroupBalancesStoryProps {
    // Whether anybody owes anything
    debts: boolean;
    // Whether the group is open, so that its lines offer Settle up
    open: boolean;
    // Whether the group shows the fewest payments instead of pair by pair
    simplified: boolean;
}

const member = (id: string, name: string, rest: Partial<GroupMember> = {}): GroupMember => ({
    id,
    name,
    role: 'member',
    claimed: true,
    leftAt: null,
    mergedInto: null,
    ...rest,
});

// Marta, who uses the app, Bruno, Carla, who left, and an Ana who deleted her account
const GROUP: SharedGroup = {
    id: 'trip',
    kind: 'group',
    name: 'Lisbon',
    currency: 'EUR',
    simplifyDebts: false,
    closed: null,
    archived: false,
    me: 'marta',
    showInExpenses: true,
    members: [
        member('marta', 'Marta', { role: 'owner' }),
        member('bruno', 'Bruno'),
        member('carla', 'Carla', { leftAt: 1 }),
        member('ana', ''),
    ],
};

const dinner = (id: string, paidBy: string, shares: Record<string, number>): SharedEntry => {
    const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
    return {
        id,
        kind: 'expense',
        text: id,
        categoryId: 'food',
        amountCents: list.reduce((sum, share) => sum + share.cents, 0),
        currency: 'EUR',
        date: '2026-10-25',
        paidBy,
        split: 'exact',
        shares: list,
        payment: 'direct',
        chargeDate: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
    };
};

const ENTRIES: readonly SharedEntry[] = [
    dinner('dinner', 'marta', { marta: 3000, bruno: 3000, carla: 3000 }),
    dinner('museum', 'bruno', { bruno: 1250, ana: 1250 }),
];

const Story: Meta<GroupBalancesStoryProps> = {
    title: 'Features/GroupBalances',
    args: { debts: true, open: true, simplified: false },
};

const settle = fn();

export const GroupBalances = (args: GroupBalancesStoryProps) => {
    const { debts, open, simplified } = args;
    const group = { ...GROUP, simplifyDebts: simplified };
    const entries = debts ? ENTRIES : [];

    return (
        <GroupBalancesComponent
            group={group}
            entries={entries}
            debts={groupDebts(entries, group.members, simplified)}
            onSettle={open ? settle : undefined}
        />
    );
};

export default Story;
