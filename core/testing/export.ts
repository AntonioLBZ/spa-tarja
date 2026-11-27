import { type BackupLedger, type CsvLabels } from '@core/export/export';
import { sharedExpenseRows } from '@core/groups/shared-expense';

import type { Category } from '@core/categories/category';
import type { Expense } from '@core/expenses/expense';
import type { Income } from '@core/expenses/income';
import type { LedgerEntry } from '@core/groups/shared-entry';
import type { GroupMember, SharedGroup } from '@core/groups/shared-group';

const BOM = '﻿';

const expense = (overrides: Partial<Expense> = {}): Expense => {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-10-24',
        payment: 'direct',
        chargeDate: null,
        personalCents: null,
        plan: null,
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
};

const NOW = new Date(2026, 9, 25, 12, 30);

const TRIP_ID = 'a1111111-0000-4000-8000-000000000000';

const DANI_ID = 'b2222222-0000-4000-8000-000000000000';

type Dinner = Extract<LedgerEntry, { kind: 'expense' }>;

type Settlement = Extract<LedgerEntry, { kind: 'settlement' }>;

const member = (id: string, name: string, overrides: Partial<GroupMember> = {}): GroupMember => {
    return { id, name, role: 'member', claimed: true, leftAt: null, mergedInto: null, ...overrides };
};

const group = (overrides: Partial<SharedGroup> = {}): SharedGroup => {
    return {
        id: TRIP_ID,
        kind: 'group',
        name: 'Trip',
        currency: 'EUR',
        simplifyDebts: false,
        closed: null,
        archived: false,
        me: 'ana',
        showInExpenses: true,
        pinnedAt: null,
        seq: 0,
        members: [member('ana', 'Ana', { role: 'owner' }), member('bea', 'Bea')],
        ...overrides,
    };
};

const dinner = (overrides: Partial<Dinner> = {}): Dinner => {
    return {
        id: crypto.randomUUID(),
        kind: 'expense',
        text: 'Dinner',
        categoryId: 'food',
        amountCents: 4000,
        currency: 'EUR',
        date: '2026-10-25',
        paidBy: 'ana',
        split: 'equal',
        shares: [
            { memberId: 'ana', cents: 2000 },
            { memberId: 'bea', cents: 2000 },
        ],
        payment: 'direct',
        chargeDate: null,
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        createdBy: 'ana',
        updatedBy: 'ana',
        ...overrides,
    };
};

const settlement = (overrides: Partial<Settlement> = {}): Settlement => {
    return {
        id: crypto.randomUUID(),
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: 1500,
        currency: 'EUR',
        date: '2026-10-26',
        paidBy: 'bea',
        split: 'exact',
        shares: [{ memberId: 'ana', cents: 1500 }],
        payment: 'direct',
        chargeDate: null,
        createdAt: 2_000,
        updatedAt: 2_000,
        deletedAt: null,
        createdBy: 'bea',
        updatedBy: 'bea',
        ...overrides,
    };
};

const ledger = (target: SharedGroup, ...entries: LedgerEntry[]): BackupLedger => {
    return { group: target, entries };
};

const partsOf = ({ group: target, entries }: BackupLedger) => {
    return sharedExpenseRows([
        {
            groupId: target.id,
            me: target.me,
            showInExpenses: target.showInExpenses,
            members: target.members,
            entries,
        },
    ]);
};

const GYM: Category = {
    id: '5d4a8c4e-2f1a-4c33-8e0e-3d1b2f6a9c11',
    name: 'Gym',
    color: 'blue',
    icon: 'fitness_center',
};

const INCOME: Income[] = [
    { month: '2026-10', amountCents: 200_000, currency: 'EUR' },
    { month: '2026-09', amountCents: 190_000, currency: 'EUR' },
];

const LABELS: CsvLabels = {
    columns: ['Date', 'Text', 'Category', 'Amount', 'Currency', 'Payment', 'Charge date', 'Your part', 'Part', 'Group'],
    payments: { direct: 'Now', credit: 'Credit card', voucher: 'Restaurant card' },
    categoryName: (id) => ({ food: 'Food', groceries: 'Groceries', other: 'Other', [GYM.id]: 'Gym' })[id] ?? 'Other',
    groupName: (id) => ({ [TRIP_ID]: 'Trip', [DANI_ID]: 'Dani' })[id] ?? '',
};

const LABELS_ES: CsvLabels = {
    columns: [
        'Fecha',
        'Texto',
        'Categoría',
        'Importe',
        'Moneda',
        'Pago',
        'Fecha de cargo',
        'Tu parte',
        'Parte',
        'Grupo',
    ],
    payments: { direct: 'Ahora', credit: 'Tarjeta de crédito', voucher: 'Tarjeta restaurante' },
    categoryName: (id) => ({ food: 'Comida', other: 'Otros' })[id] ?? 'Otros',
    groupName: (id) => ({ [TRIP_ID]: 'Viaje', [DANI_ID]: 'Dani' })[id] ?? '',
};

const rows = (csv: string): string[] => {
    return csv.slice(BOM.length).split('\r\n');
};

export {
    BOM,
    DANI_ID,
    type Dinner,
    dinner,
    expense,
    group,
    GYM,
    INCOME,
    LABELS,
    LABELS_ES,
    ledger,
    member,
    NOW,
    partsOf,
    rows,
    type Settlement,
    settlement,
    TRIP_ID,
};
