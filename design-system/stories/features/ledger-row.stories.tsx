import { CardList } from '@/components/card/card';
import { Sheet } from '@/components/sheet/sheet';
import { LedgerRow as LedgerRowComponent, type LedgerRowProps } from '@/features/groups/ledger-row';
import { fn } from 'storybook/test';

import { AppData } from './app-data';

import type { LedgerEntry } from '@core/shared-entry';
import type { GroupMember, SharedGroup } from '@core/shared-group';
import type { Meta } from '@storybook/react-vite';

const member = (id: string, name: string, rest: Partial<GroupMember> = {}): GroupMember => ({
    id,
    name,
    role: 'member',
    claimed: true,
    leftAt: null,
    mergedInto: null,
    ...rest,
});

// Marta, who looks at it, Bruno and Carla, who left
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
    ],
};

const entry = (rest: Partial<LedgerEntry>): LedgerEntry =>
    ({
        id: 'dinner',
        kind: 'expense',
        text: 'Dinner by the river',
        categoryId: 'food',
        amountCents: 6000,
        currency: 'EUR',
        date: '2026-10-25',
        paidBy: 'marta',
        split: 'equal',
        shares: [
            { memberId: 'marta', cents: 3000 },
            { memberId: 'bruno', cents: 3000 },
        ],
        payment: 'direct',
        chargeDate: null,
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        createdBy: 'marta',
        updatedBy: 'marta',
        ...rest,
    }) as LedgerEntry;

const ENTRIES = {
    yours: entry({}),
    paidByBruno: entry({ id: 'museum', text: 'Museum', paidBy: 'bruno', createdBy: 'bruno', updatedBy: 'bruno' }),
    notIn: entry({
        id: 'gift',
        text: '',
        categoryId: 'leisure',
        paidBy: 'bruno',
        shares: [{ memberId: 'bruno', cents: 6000 }],
        updatedAt: 2,
        updatedBy: 'bruno',
    }),
    withSomeoneWhoLeft: entry({
        id: 'taxi',
        text: 'Taxi',
        categoryId: 'transport',
        shares: [
            { memberId: 'marta', cents: 3000 },
            { memberId: 'carla', cents: 3000 },
        ],
    }),
    settlement: entry({
        id: 'settle',
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: 2500,
        paidBy: 'bruno',
        split: 'exact',
        shares: [{ memberId: 'marta', cents: 2500 }],
    }),
} satisfies Record<string, LedgerEntry>;

interface LedgerRowStoryProps extends Pick<LedgerRowProps, 'pending' | 'leaving'> {
    // Which entry the row shows
    kind: keyof typeof ENTRIES;
    // Whether the group is open, so that the row opens on what can be done to it
    open: boolean;
}

const Story: Meta<LedgerRowStoryProps> = {
    title: 'Features/LedgerRow',
    args: { kind: 'yours', open: true, pending: false, leaving: false },
    argTypes: { kind: { control: 'select', options: Object.keys(ENTRIES) } },
};

const actions = { onEdit: fn(), onDuplicate: fn(), onDelete: fn() };

export const LedgerRow = (args: LedgerRowStoryProps) => {
    const { kind, open, ...props } = args;

    return (
        <AppData>
            {() => (
                <Sheet label="Sunday 25 October" level="h3">
                    <CardList flush>
                        <LedgerRowComponent {...props} {...(open ? actions : {})} group={GROUP} entry={ENTRIES[kind]} />
                    </CardList>
                </Sheet>
            )}
        </AppData>
    );
};

export default Story;
