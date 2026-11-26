import { Button } from '@/components/button/button';
import { Icon } from '@/components/icon/icon';
import { GroupBalances } from '@/features/groups/balances/group-balances';
import { groupDebts } from '@core/groups/group-debts';

import type { SharedEntry } from '@core/groups/shared-entry';
import type { GroupMember, SharedGroup } from '@core/groups/shared-group';
import type { Meta } from '@storybook/react-vite';

import '@/features/groups/balances/settle-up.css';

const Story: Meta = {
    title: 'Features/GroupBalances',
    component: GroupBalances,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'code' } } },
};

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
const LISBON: SharedGroup = {
    id: 'trip',
    kind: 'group',
    name: 'Lisbon',
    currency: 'EUR',
    simplifyDebts: false,
    closed: null,
    archived: false,
    me: 'marta',
    showInExpenses: true,
    pinnedAt: null,
    seq: 0,
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

export const Basic = () => {
    return (
        <GroupBalances
            group={LISBON}
            entries={ENTRIES}
            debts={groupDebts(ENTRIES, LISBON.members, false)}
            onSettle={() => undefined}
            action={
                <Button ghost small className="settle-up__open">
                    <Icon name="payments" />
                    Settle up
                </Button>
            }
        />
    );
};

export const Simplified = () => {
    const group = { ...LISBON, simplifyDebts: true };

    return (
        <GroupBalances
            group={group}
            entries={ENTRIES}
            debts={groupDebts(ENTRIES, group.members, true)}
            onSettle={() => undefined}
            action={
                <Button ghost small className="settle-up__open">
                    <Icon name="payments" />
                    Settle up
                </Button>
            }
        />
    );
};

export const Settled = () => {
    return <GroupBalances group={LISBON} entries={[]} debts={[]} onSettle={() => undefined} />;
};

export const Closed = () => {
    const group: SharedGroup = { ...LISBON, closed: 'deleted' };

    return <GroupBalances group={group} entries={ENTRIES} debts={groupDebts(ENTRIES, group.members, false)} />;
};

export default Story;
