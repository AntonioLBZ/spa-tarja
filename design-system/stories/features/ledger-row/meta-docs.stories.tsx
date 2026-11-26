import { CardList } from '@/components/card/card';
import { Sheet } from '@/components/sheet/sheet';
import { LedgerRow } from '@/features/groups/ledger/ledger-row';
import { withAppData } from '@stories/shared/app-data';

import type { LedgerEntry } from '@core/groups/shared-entry';
import type { GroupMember, SharedGroup } from '@core/groups/shared-group';
import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/LedgerRow',
    component: LedgerRow,
    tags: ['!dev'],
    decorators: [
        (Story) => (
            <Sheet label="Sunday 25 October" level="h3">
                <CardList flush>
                    <Story />
                </CardList>
            </Sheet>
        ),
        withAppData,
    ],
    parameters: { docs: { source: { type: 'code' }, story: { inline: false, iframeHeight: 180 } } },
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

// Marta, who looks at it, Bruno and Carla, who left
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

const DINNER = entry({});

const ACTIONS = { onEdit: () => undefined, onDuplicate: () => undefined, onDelete: () => undefined };

export const Basic = () => {
    return <LedgerRow group={LISBON} entry={DINNER} pending={false} leaving={false} {...ACTIONS} />;
};

export const PaidBySomeoneElse = () => {
    const museum = entry({ id: 'museum', text: 'Museum', paidBy: 'bruno', createdBy: 'bruno', updatedBy: 'bruno' });

    return <LedgerRow group={LISBON} entry={museum} pending={false} leaving={false} {...ACTIONS} />;
};

export const NotIn = () => {
    const gift = entry({
        id: 'gift',
        text: 'Gift',
        categoryId: 'leisure',
        paidBy: 'bruno',
        shares: [{ memberId: 'bruno', cents: 6000 }],
        updatedAt: 2,
        updatedBy: 'bruno',
    });

    return <LedgerRow group={LISBON} entry={gift} pending={false} leaving={false} {...ACTIONS} />;
};

export const JustYou = () => {
    const book = entry({ id: 'book', text: 'Book', amountCents: 1500, shares: [{ memberId: 'marta', cents: 1500 }] });

    return <LedgerRow group={LISBON} entry={book} pending={false} leaving={false} {...ACTIONS} />;
};

export const Settlement = () => {
    const settlement = entry({
        id: 'settle',
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: 2500,
        paidBy: 'bruno',
        split: 'exact',
        shares: [{ memberId: 'marta', cents: 2500 }],
    });

    return <LedgerRow group={LISBON} entry={settlement} pending={false} leaving={false} {...ACTIONS} />;
};

export const WithSomeoneWhoLeft = () => {
    const taxi = entry({
        id: 'taxi',
        text: 'Taxi',
        categoryId: 'transport',
        shares: [
            { memberId: 'marta', cents: 3000 },
            { memberId: 'carla', cents: 3000 },
        ],
    });

    return <LedgerRow group={LISBON} entry={taxi} pending={false} leaving={false} {...ACTIONS} />;
};

export const WithDate = () => {
    return <LedgerRow group={LISBON} entry={DINNER} date="Oct 25" pending={false} leaving={false} {...ACTIONS} />;
};

export const Closed = () => {
    return <LedgerRow group={LISBON} entry={DINNER} pending={false} leaving={false} />;
};

export const Pending = () => {
    return <LedgerRow group={LISBON} entry={DINNER} pending leaving={false} {...ACTIONS} />;
};

export const LongNames = () => {
    const house: SharedGroup = {
        ...LISBON,
        id: 'long',
        name: 'Summer house',
        members: [
            member('marta', 'Marta', { role: 'owner' }),
            member('max', 'Maximiliano Fernández-Castellanos'),
            member('bart', 'Bartolomeo Villanueva'),
        ],
    };
    const dinner = entry({
        id: 'long-dinner',
        text: 'Dinner at the restaurant by the old harbour with everybody',
        paidBy: 'max',
        amountCents: 123456,
        shares: ['marta', 'max', 'bart'].map((memberId) => ({ memberId, cents: 41152 })),
        updatedBy: 'max',
    });

    return <LedgerRow group={house} entry={dinner} pending={false} leaving={false} {...ACTIONS} />;
};

export default Story;
