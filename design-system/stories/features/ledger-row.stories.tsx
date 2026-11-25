import { CardList } from '@/components/card/card';
import { Sheet } from '@/components/sheet/sheet';
import { LedgerRow as LedgerRowComponent, type LedgerRowProps } from '@/features/groups/ledger/ledger-row';
import { fn } from 'storybook/test';

import { AppData } from './app-data';

import type { LedgerEntry } from '@core/groups/shared-entry';
import type { GroupMember, SharedGroup } from '@core/groups/shared-group';
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
    // Whether the details start with the day, as in the ledger in the order they were added
    withDate: boolean;
}

const Story: Meta<LedgerRowStoryProps> = {
    title: 'Features/LedgerRow',
    args: { kind: 'yours', open: true, withDate: false, pending: false, leaving: false },
    argTypes: { kind: { control: 'select', options: Object.keys(ENTRIES) } },
};

const actions = { onEdit: fn(), onDuplicate: fn(), onDelete: fn() };

export const LedgerRow = (args: LedgerRowStoryProps) => {
    const { kind, open, withDate, ...props } = args;

    return (
        <AppData>
            {() => (
                <Sheet label="Sunday 25 October" level="h3">
                    <CardList flush>
                        <LedgerRowComponent
                            {...props}
                            {...(open ? actions : {})}
                            date={withDate ? 'Oct 25' : undefined}
                            group={GROUP}
                            entry={ENTRIES[kind]}
                        />
                    </CardList>
                </Sheet>
            )}
        </AppData>
    );
};

const SIX: SharedGroup = {
    ...GROUP,
    id: 'cabin',
    name: 'Cabin',
    members: ['Marta', 'Agustín', 'Carla', 'Diego', 'Elena', 'Fran'].map((name, index) =>
        member(name.toLowerCase(), name, index === 0 ? { role: 'owner' } : {})
    ),
};

const share = (ids: string[], cents: number) => ids.map((memberId) => ({ memberId, cents }));

// Long names, to see that they wrap and never push the amount or the chevron away
const LONG: SharedGroup = {
    ...GROUP,
    id: 'long',
    name: 'Summer house',
    members: [
        member('marta', 'Marta', { role: 'owner' }),
        member('max', 'Maximiliano Fernández-Castellanos'),
        member('bart', 'Bartolomeo Villanueva'),
    ],
};

// A ledger of each size: every kind of row a person reads in it
const LEDGERS: [string, SharedGroup, LedgerEntry[]][] = [
    [
        '3 people',
        { ...GROUP, members: GROUP.members.map((one) => ({ ...one, leftAt: null })) },
        [
            entry({ amountCents: 9675, shares: share(['marta', 'bruno', 'carla'], 3225) }),
            ENTRIES.paidByBruno,
            ENTRIES.notIn,
            entry({ id: 'book', text: 'Book', amountCents: 1500, shares: share(['marta'], 1500) }),
            ENTRIES.settlement,
            {
                ...ENTRIES.settlement,
                id: 'back',
                paidBy: 'marta',
                shares: [{ memberId: 'bruno', cents: 1100 }],
                amountCents: 1100,
            },
        ],
    ],
    [
        '6 people',
        SIX,
        [
            entry({
                id: 'cabin',
                text: 'Cabin',
                categoryId: 'housing',
                amountCents: 72012,
                shares: share(['marta', 'agustín', 'carla', 'diego', 'elena', 'fran'], 12002),
            }),
            entry({
                id: 'fuel',
                text: 'Fuel',
                categoryId: 'transport',
                paidBy: 'agustín',
                amountCents: 921,
                shares: share(['marta', 'agustín', 'carla'], 307),
                updatedBy: 'agustín',
            }),
            entry({
                id: 'drinks',
                text: 'Drinks',
                paidBy: 'elena',
                amountCents: 4500,
                shares: share(['diego', 'elena', 'fran'], 1500),
                updatedBy: 'elena',
            }),
            {
                ...ENTRIES.settlement,
                id: 'settle6',
                paidBy: 'diego',
                shares: [{ memberId: 'fran', cents: 2000 }],
                amountCents: 2000,
            },
        ],
    ],
    [
        'Long names',
        LONG,
        [
            entry({
                id: 'long-dinner',
                text: 'Dinner at the restaurant by the old harbour with everybody',
                paidBy: 'max',
                amountCents: 123456,
                shares: share(['marta', 'max', 'bart'], 41152),
                updatedBy: 'max',
            }),
            {
                ...ENTRIES.settlement,
                id: 'long-settle',
                paidBy: 'max',
                shares: [{ memberId: 'bart', cents: 325 }],
                amountCents: 325,
            },
            {
                ...ENTRIES.settlement,
                id: 'long-mine',
                paidBy: 'marta',
                shares: [{ memberId: 'max', cents: 98765 }],
                amountCents: 98765,
            },
        ],
    ],
];

// Both sizes, light beside dark; the toolbar's Amounts turns color off and on
export const Ledgers = () => (
    <AppData>
        {() => (
            <div
                style={{
                    display: 'grid',
                    gap: 'var(--size-4)',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
                }}
            >
                {(['light', 'dark'] as const).map((scheme) => (
                    <div
                        key={scheme}
                        style={{
                            background: 'var(--color-bg-primary)',
                            color: 'var(--color-content-primary)',
                            colorScheme: scheme,
                            display: 'grid',
                            gap: 'var(--size-6)',
                            padding: 'var(--size-4)',
                        }}
                    >
                        {LEDGERS.map(([caption, group, entries]) => (
                            <Sheet key={caption} label={`${caption} (${scheme})`} level="h3">
                                <CardList flush>
                                    {entries.map((one) => (
                                        <LedgerRowComponent
                                            key={one.id}
                                            {...actions}
                                            group={group}
                                            entry={one}
                                            pending={false}
                                            leaving={false}
                                        />
                                    ))}
                                </CardList>
                            </Sheet>
                        ))}
                    </div>
                ))}
            </div>
        )}
    </AppData>
);
Ledgers.globals = { viewport: { value: 'desktop' } };

export const LedgersOnAPhone = () => <Ledgers />;
LedgersOnAPhone.globals = { viewport: { value: 'phone' } };
LedgersOnAPhone.parameters = { layout: 'fullscreen' };

export const LedgersOnANarrowPhone = () => <Ledgers />;
LedgersOnANarrowPhone.globals = { viewport: { value: 'narrow' } };
LedgersOnANarrowPhone.parameters = { layout: 'fullscreen' };

export default Story;
