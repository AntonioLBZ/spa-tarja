import { describe, expect, it } from 'vitest';

import { backupJson, buildBackup, expensesCsv, exportFileName, type BackupLedger, type CsvLabels } from './export';
import { sharedExpenseRows } from './shared-expense';

import type { Budget } from './budget';
import type { Category } from './category';
import type { Expense } from './expense';
import type { Income } from './income';
import type { LedgerEntry } from './shared-entry';
import type { GroupMember, SharedGroup } from './shared-group';

const BOM = '﻿';

function expense(overrides: Partial<Expense> = {}): Expense {
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
}

const NOW = new Date(2026, 9, 25, 12, 30);

const TRIP_ID = 'a1111111-0000-4000-8000-000000000000';
const DANI_ID = 'b2222222-0000-4000-8000-000000000000';

type Dinner = Extract<LedgerEntry, { kind: 'expense' }>;
type Settlement = Extract<LedgerEntry, { kind: 'settlement' }>;

function member(id: string, name: string, overrides: Partial<GroupMember> = {}): GroupMember {
    return { id, name, role: 'member', claimed: true, leftAt: null, mergedInto: null, ...overrides };
}

function group(overrides: Partial<SharedGroup> = {}): SharedGroup {
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
}

function dinner(overrides: Partial<Dinner> = {}): Dinner {
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
}

function settlement(overrides: Partial<Settlement> = {}): Settlement {
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
}

function ledger(target: SharedGroup, ...entries: LedgerEntry[]): BackupLedger {
    return { group: target, entries };
}

function partsOf({ group: target, entries }: BackupLedger) {
    return sharedExpenseRows([
        {
            groupId: target.id,
            me: target.me,
            showInExpenses: target.showInExpenses,
            members: target.members,
            entries,
        },
    ]);
}

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

function rows(csv: string): string[] {
    return csv.slice(BOM.length).split('\r\n');
}

describe('buildBackup', () => {
    it('names the app and the version of the format, and says when it was made', () => {
        const backup = buildBackup({ expenses: [], categories: [], income: [], budgets: [], groups: [] }, NOW);

        expect(backup).toEqual({
            app: 'tarja',
            version: 1,
            exportedAt: NOW.toISOString(),
            expenses: [],
            categories: [],
            income: [],
            budgets: [],
            groups: [],
        });
    });

    it('keeps the stored fields of every expense as they are', () => {
        const dinner = expense({
            text: 'Dinner',
            payment: 'voucher',
            chargeDate: '2026-11-12',
            personalCents: 600,
            createdAt: 5,
            updatedAt: 9,
        });

        const backup = buildBackup({ expenses: [dinner], categories: [], income: [], budgets: [], groups: [] }, NOW);

        expect(backup.expenses).toEqual([dinner]);
    });

    it('leaves out the deleted expenses', () => {
        const kept = expense({ text: 'Kept' });
        const gone = expense({ text: 'Gone', deletedAt: 5_000 });

        const backup = buildBackup(
            { expenses: [gone, kept], categories: [], income: [], budgets: [], groups: [] },
            NOW
        );

        expect(backup.expenses.map((item) => item.text)).toEqual(['Kept']);
    });

    it('has one entry for each part of a plan', () => {
        const plan = { id: crypto.randomUUID(), parts: 3 };
        const parts = [3, 1, 2].map((part) => expense({ text: 'Sofa', plan: { ...plan, part }, date: '2026-10-01' }));

        const backup = buildBackup({ expenses: parts, categories: [], income: [], budgets: [], groups: [] }, NOW);

        expect(backup.expenses.map((item) => item.plan?.part)).toEqual([1, 2, 3]);
    });

    it('orders the expenses by the day made, then when they were created, then the id', () => {
        const a = expense({ id: 'a0000000-0000-4000-8000-000000000000', date: '2026-10-02', createdAt: 2 });
        const b = expense({ id: 'b0000000-0000-4000-8000-000000000000', date: '2026-10-01', createdAt: 9 });
        const c = expense({ id: 'c0000000-0000-4000-8000-000000000000', date: '2026-10-02', createdAt: 1 });
        const d = expense({ id: 'd0000000-0000-4000-8000-000000000000', date: '2026-10-02', createdAt: 1 });

        const backup = buildBackup(
            { expenses: [d, a, b, c], categories: [], income: [], budgets: [], groups: [] },
            NOW
        );

        expect(backup.expenses.map((item) => item.id)).toEqual([b.id, c.id, d.id, a.id]);
    });

    it('holds the custom categories and the income of every month', () => {
        const backup = buildBackup({ expenses: [], categories: [GYM], income: INCOME, budgets: [], groups: [] }, NOW);

        expect(backup.categories).toEqual([GYM]);
        expect(backup.income.map((item) => item.month)).toEqual(['2026-09', '2026-10']);
        expect(backup.income[1]).toEqual(INCOME[0]);
    });

    it('holds the budgets ordered by month and then scope', () => {
        const budgets: Budget[] = [
            { month: '2026-11', scope: 'food', amountCents: 100, currency: 'EUR' },
            { month: '2026-10', scope: 'total', amountCents: 900, currency: 'EUR' },
            { month: '2026-10', scope: 'food', amountCents: 0, currency: 'EUR' },
        ];

        const backup = buildBackup({ expenses: [], categories: [], income: [], budgets, groups: [] }, NOW);

        expect(backup.budgets).toEqual([budgets[2], budgets[1], budgets[0]]);
        expect(budgets.map((item) => item.month)).toEqual(['2026-11', '2026-10', '2026-10']);
    });

    it('does not change what it is given', () => {
        const expenses = [expense({ date: '2026-10-02' }), expense({ date: '2026-10-01' })];
        const ids = expenses.map((item) => item.id);

        buildBackup({ expenses, categories: [], income: INCOME, budgets: [], groups: [] }, NOW);

        expect(expenses.map((item) => item.id)).toEqual(ids);
        expect(INCOME.map((item) => item.month)).toEqual(['2026-10', '2026-09']);
    });
});

describe('the groups of the backup', () => {
    const backupOf = (...groups: BackupLedger[]) => {
        return buildBackup({ expenses: [], categories: [], income: [], budgets: [], groups }, NOW);
    };

    it('holds each group as the server tells it, with its people and its entries as stored', () => {
        const dani = group({
            id: DANI_ID,
            kind: 'direct',
            name: null,
            members: [member('ana', 'Ana', { role: 'owner' }), member('dani', 'Dani', { claimed: false })],
        });
        const lunch = dinner({
            id: 'e0000000-0000-4000-8000-000000000001',
            split: 'percent',
            payment: 'credit',
            chargeDate: '2026-11-24',
            createdBy: 'bea',
            updatedBy: null,
        });

        const backup = backupOf(ledger(group({ simplifyDebts: true }), lunch), ledger(dani));

        expect(backup.groups).toEqual([
            {
                id: TRIP_ID,
                kind: 'group',
                name: 'Trip',
                currency: 'EUR',
                simplifyDebts: true,
                closed: null,
                archived: false,
                showInExpenses: true,
                pinned: false,
                me: 'ana',
                members: [
                    { id: 'ana', name: 'Ana', role: 'owner', claimed: true, leftAt: null, mergedInto: null },
                    { id: 'bea', name: 'Bea', role: 'member', claimed: true, leftAt: null, mergedInto: null },
                ],
                entries: [
                    {
                        id: lunch.id,
                        kind: 'expense',
                        text: 'Dinner',
                        categoryId: 'food',
                        amountCents: 4000,
                        currency: 'EUR',
                        date: '2026-10-25',
                        paidBy: 'ana',
                        split: 'percent',
                        shares: [
                            { memberId: 'ana', cents: 2000 },
                            { memberId: 'bea', cents: 2000 },
                        ],
                        payment: 'credit',
                        chargeDate: '2026-11-24',
                        createdAt: 1_000,
                        updatedAt: 1_000,
                        deletedAt: null,
                        createdBy: 'bea',
                        updatedBy: null,
                    },
                ],
            },
            {
                id: DANI_ID,
                kind: 'direct',
                name: null,
                currency: 'EUR',
                simplifyDebts: false,
                closed: null,
                archived: false,
                showInExpenses: true,
                pinned: false,
                me: 'ana',
                members: [
                    { id: 'ana', name: 'Ana', role: 'owner', claimed: true, leftAt: null, mergedInto: null },
                    { id: 'dani', name: 'Dani', role: 'member', claimed: false, leftAt: null, mergedInto: null },
                ],
                entries: [],
            },
        ]);
    });

    it('keeps a group whose switch is off, a closed one and an archived one, with the flags and the pin as they are', () => {
        const backup = backupOf(
            ledger(group({ id: 'g1', showInExpenses: false, pinnedAt: 1_000 }), dinner()),
            ledger(group({ id: 'g2', closed: 'left', archived: true }), dinner()),
            ledger(group({ id: 'g3', closed: 'deleted' }), dinner())
        );

        expect(
            backup.groups.map((item) => [item.id, item.showInExpenses, item.closed, item.archived, item.pinned])
        ).toEqual([
            ['g1', false, null, false, true],
            ['g2', true, 'left', true, false],
            ['g3', true, 'deleted', false, false],
        ]);
        expect(backup.groups.map((item) => item.entries.length)).toEqual([1, 1, 1]);
    });

    it('keeps a member who left, a placeholder merged into somebody and a deleted account as stored', () => {
        const people = [
            member('ana', 'Ana', { role: 'owner' }),
            member('bea', 'Bea', { leftAt: 5_000 }),
            member('dummy', 'Cris', { claimed: false, leftAt: 6_000, mergedInto: 'ana' }),
            member('gone', ''),
        ];

        const backup = backupOf(ledger(group({ members: people }), dinner({ paidBy: 'dummy' })));

        expect(backup.groups[0]!.members).toEqual(people);
        expect(backup.groups[0]!.entries[0]!.paidBy).toBe('dummy');
    });

    it('holds a group with no entries as an empty list', () => {
        expect(backupOf(ledger(group())).groups[0]!.entries).toEqual([]);
    });

    it('keeps the settlements, leaves out the deleted entries and orders them by day, creation and id', () => {
        const a = dinner({ id: 'a0000000-0000-4000-8000-000000000000', date: '2026-10-25', createdAt: 2 });
        const b = dinner({ id: 'b0000000-0000-4000-8000-000000000000', date: '2026-10-24', createdAt: 9 });
        const c = dinner({ id: 'c0000000-0000-4000-8000-000000000000', date: '2026-10-25', createdAt: 1 });
        const d = dinner({ id: 'd0000000-0000-4000-8000-000000000000', date: '2026-10-25', createdAt: 1 });
        const paid = settlement({ date: '2026-10-26' });
        const gone = dinner({ deletedAt: 5_000 });

        const backup = backupOf(ledger(group(), d, a, gone, paid, b, c));

        expect(backup.groups[0]!.entries.map((entry) => entry.id)).toEqual([b.id, c.id, d.id, a.id, paid.id]);
        expect(backup.groups[0]!.entries.at(-1)).toMatchObject({ kind: 'settlement', categoryId: null });
    });

    it('keeps the order of the groups it is given', () => {
        const backup = backupOf(ledger(group({ id: 'g2' })), ledger(group({ id: 'g1' })));

        expect(backup.groups.map((item) => item.id)).toEqual(['g2', 'g1']);
    });

    it('writes no email, no user id and nothing else a group or an entry carries beyond its stored fields', () => {
        const leakyMember = { ...member('ana', 'Ana'), email: 'ana@example.com', userId: 'user-ana-1' };
        const leakyGroup = {
            ...group({ members: [leakyMember, member('bea', 'Bea')] }),
            ownerEmail: 'ana@example.com',
        };
        const leakyEntry = { ...dinner(), groupId: TRIP_ID, createdByUser: 'user-ana-1' };

        const json = backupJson(
            { expenses: [], categories: [], income: [], budgets: [], groups: [ledger(leakyGroup, leakyEntry)] },
            NOW
        );

        expect(json).not.toContain('ana@example.com');
        expect(json).not.toContain('user-ana-1');
        expect(json).not.toContain('groupId');
        expect(json).toContain('"name": "Ana"');
    });

    it('does not change what it is given', () => {
        const entries = [dinner({ date: '2026-10-26' }), dinner({ date: '2026-10-24' })];
        const ids = entries.map((entry) => entry.id);

        backupOf(ledger(group(), ...entries));

        expect(entries.map((entry) => entry.id)).toEqual(ids);
    });

    it('never holds a shared row among the expenses', () => {
        const mine = expense({ text: 'Mine' });
        const [row] = partsOf(ledger(group(), dinner()));

        const backup = buildBackup(
            { expenses: [mine, row!], categories: [], income: [], budgets: [], groups: [] },
            NOW
        );

        expect(backup.expenses).toEqual([mine]);
    });
});

describe('backupJson', () => {
    it('is the backup as readable JSON that reads back to the same thing', () => {
        const data = {
            expenses: [expense({ text: 'Café' })],
            categories: [GYM],
            income: INCOME,
            budgets: [],
            groups: [],
        };

        const json = backupJson(data, NOW);

        expect(JSON.parse(json)).toEqual(buildBackup(data, NOW));
        expect(json).toContain('\n  "app": "tarja"');
        expect(json.endsWith('\n')).toBe(true);
    });
});

describe('expensesCsv', () => {
    it('starts with a byte order mark, so a spreadsheet reads the accents', () => {
        expect(expensesCsv([], 'en', LABELS).startsWith(BOM)).toBe(true);
    });

    it('is just the header when there is nothing to list', () => {
        expect(rows(expensesCsv([], 'en', LABELS))).toEqual([
            'Date,Text,Category,Amount,Currency,Payment,Charge date,Your part,Part,Group',
            '',
        ]);
    });

    it('has a row for each expense, in English with commas and a decimal point', () => {
        const csv = expensesCsv([expense({ text: 'Lunch', date: '2026-10-24', amountCents: 1250 })], 'en', LABELS);

        expect(rows(csv)).toEqual([
            'Date,Text,Category,Amount,Currency,Payment,Charge date,Your part,Part,Group',
            '2026-10-24,Lunch,Food,12.50,EUR,Now,,,,',
            '',
        ]);
    });

    it('uses semicolons and a decimal comma in Spanish, with the header and the names in Spanish', () => {
        const csv = expensesCsv([expense({ text: 'Almuerzo', amountCents: 1250 })], 'es', LABELS_ES);

        expect(rows(csv)).toEqual([
            'Fecha;Texto;Categoría;Importe;Moneda;Pago;Fecha de cargo;Tu parte;Parte;Grupo',
            '2026-10-24;Almuerzo;Comida;12,50;EUR;Ahora;;;;',
            '',
        ]);
    });

    it('writes no thousands separator, and the cents of a small amount', () => {
        const csv = expensesCsv(
            [expense({ amountCents: 123_456_78, createdAt: 1 }), expense({ amountCents: 5, createdAt: 2 })],
            'en',
            LABELS
        );

        expect(
            rows(csv)
                .slice(1, 3)
                .map((line) => line.split(',')[3])
        ).toEqual(['123456.78', '0.05']);
    });

    it('names the category the way the labels do, the fallback for one that no longer exists', () => {
        const csv = expensesCsv(
            [
                expense({ categoryId: GYM.id, text: 'Month', createdAt: 1 }),
                expense({ categoryId: crypto.randomUUID(), text: 'Lost', createdAt: 2 }),
            ],
            'en',
            LABELS
        );

        expect(
            rows(csv)
                .slice(1, 3)
                .map((line) => line.split(',')[2])
        ).toEqual(['Gym', 'Other']);
    });

    it('says how a card payment was paid, and the day it is charged', () => {
        const csv = expensesCsv(
            [expense({ text: 'Shoes', payment: 'credit', chargeDate: '2026-11-02', amountCents: 8000 })],
            'en',
            LABELS
        );

        expect(rows(csv)[1]).toBe('2026-10-24,Shoes,Food,80.00,EUR,Credit card,2026-11-02,,,');
    });

    it('gives your part of a restaurant card expense, the whole amount when none was set', () => {
        const csv = expensesCsv(
            [
                expense({
                    text: 'Dinner',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    amountCents: 4000,
                    personalCents: 2050,
                    createdAt: 1,
                }),
                expense({
                    text: 'Menu',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    amountCents: 1100,
                    createdAt: 2,
                }),
                expense({
                    text: 'Nothing',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    amountCents: 900,
                    personalCents: 0,
                    createdAt: 3,
                }),
            ],
            'en',
            LABELS
        );

        expect(rows(csv).slice(1, 4)).toEqual([
            '2026-10-24,Dinner,Food,40.00,EUR,Restaurant card,2026-11-12,20.50,,',
            '2026-10-24,Menu,Food,11.00,EUR,Restaurant card,2026-11-12,11.00,,',
            '2026-10-24,Nothing,Food,9.00,EUR,Restaurant card,2026-11-12,0.00,,',
        ]);
    });

    it('leaves your part empty for what is not a restaurant card expense', () => {
        const csv = expensesCsv([expense({ payment: undefined, personalCents: undefined })], 'en', LABELS);

        expect(rows(csv)[1]!.split(',').slice(5)).toEqual(['Now', '', '', '', '']);
    });

    it('numbers the parts of a plan, a row for each, in the order of the plan', () => {
        const plan = { id: crypto.randomUUID(), parts: 3 };
        const charges = ['2026-10-01', '2026-11-01', '2026-12-01'];
        const parts = [2, 3, 1].map((part) =>
            expense({
                text: 'Sofa',
                plan: { ...plan, part },
                date: '2026-10-01',
                chargeDate: charges[part - 1],
                amountCents: 500 * part,
            })
        );

        const csv = expensesCsv(parts, 'en', LABELS);

        expect(rows(csv).slice(1, 4)).toEqual([
            '2026-10-01,Sofa,Food,5.00,EUR,Now,2026-10-01,,1/3,',
            '2026-10-01,Sofa,Food,10.00,EUR,Now,2026-11-01,,2/3,',
            '2026-10-01,Sofa,Food,15.00,EUR,Now,2026-12-01,,3/3,',
        ]);
    });

    it('leaves out the deleted expenses', () => {
        const csv = expensesCsv([expense({ text: 'Kept' }), expense({ text: 'Gone', deletedAt: 3_000 })], 'en', LABELS);

        expect(rows(csv)).toHaveLength(3);
        expect(csv).toContain('Kept');
        expect(csv).not.toContain('Gone');
    });

    it('lists them in the order of the backup', () => {
        const csv = expensesCsv(
            [
                expense({ text: 'Later', date: '2026-10-25', createdAt: 1 }),
                expense({ text: 'Earlier', date: '2026-10-20' }),
                expense({ text: 'Same day later', date: '2026-10-25', createdAt: 5 }),
            ],
            'en',
            LABELS
        );

        expect(
            rows(csv)
                .slice(1, 4)
                .map((line) => line.split(',')[1])
        ).toEqual(['Earlier', 'Later', 'Same day later']);
    });

    it('keeps the currency of each expense', () => {
        const csv = expensesCsv([expense({ currency: 'USD' })], 'en', LABELS);

        expect(rows(csv)[1]!.split(',')[4]).toBe('USD');
    });

    describe('quoting', () => {
        it('wraps a field with the delimiter and doubles the quotes in it', () => {
            const csv = expensesCsv([expense({ text: 'Bread, "fresh"' })], 'en', LABELS);

            expect(rows(csv)[1]).toBe('2026-10-24,"Bread, ""fresh""",Food,12.50,EUR,Now,,,,');
        });

        it('wraps a field with a line break, which stays inside it', () => {
            const csv = expensesCsv([expense({ text: 'Two\nlines' })], 'en', LABELS);

            expect(csv).toContain('"Two\nlines"');
            expect(rows(csv)).toHaveLength(3);
        });

        it('quotes by the delimiter of the language: a semicolon only matters in Spanish', () => {
            const text = 'Pan; leche, huevos';

            expect(expensesCsv([expense({ text })], 'es', LABELS_ES)).toContain(`;"${text}";`);
            expect(expensesCsv([expense({ text })], 'en', LABELS)).toContain(`,"${text}",`);
            expect(expensesCsv([expense({ text: 'Pan; leche' })], 'en', LABELS)).toContain(',Pan; leche,');
            expect(expensesCsv([expense({ text: 'Pan, leche' })], 'es', LABELS_ES)).toContain(';Pan, leche;');
        });

        it('does not touch a plain text with accents', () => {
            expect(rows(expensesCsv([expense({ text: 'Café con leche ñ' })], 'en', LABELS))[1]).toContain(
                ',Café con leche ñ,'
            );
        });
    });

    describe('a text a spreadsheet could run as a formula', () => {
        it.each(['=SUM(A1:A9)', '+1', '-1', '@cmd', '\tx', '\rx'])('gets a leading apostrophe: %j', (text) => {
            const csv = expensesCsv([expense({ text })], 'en', LABELS);

            expect(rows(csv)[1]).toContain(`'${text}`);
        });

        it('is guarded before it is quoted', () => {
            const csv = expensesCsv([expense({ text: '=HYPERLINK("http://x","y")' })], 'en', LABELS);

            expect(rows(csv)[1]).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
        });

        it('is guarded in the name of a category too', () => {
            const evil = { ...LABELS, categoryName: () => '=cmd|calc' };

            const csv = expensesCsv([expense()], 'en', evil);

            expect(rows(csv)[1]).toContain(",'=cmd|calc,");
        });

        it.each(['a=b', 'x+1', ' =x', '1-2'])('is left alone when it only has the sign inside: %j', (text) => {
            const csv = expensesCsv([expense({ text })], 'en', LABELS);

            expect(rows(csv)[1]).toContain(`,${text},`);
        });
    });
});

describe('the shared rows of the CSV', () => {
    const csvOf = (locale: 'en' | 'es', ...ledgers: BackupLedger[]) => {
        return expensesCsv(ledgers.flatMap(partsOf), locale, locale === 'en' ? LABELS : LABELS_ES);
    };

    it('has your part of what somebody else paid, with the total, "Now" and the group', () => {
        const csv = csvOf('en', ledger(group({ me: 'bea' }), dinner()));

        expect(rows(csv)).toEqual([
            'Date,Text,Category,Amount,Currency,Payment,Charge date,Your part,Part,Group',
            '2026-10-25,Dinner,Food,40.00,EUR,Now,,20.00,,Trip',
            '',
        ]);
    });

    it('says how you paid, and the day it is charged, when you are the payer', () => {
        const csv = csvOf(
            'en',
            ledger(
                group(),
                dinner({ text: 'Hotel', payment: 'credit', chargeDate: '2026-11-02', createdAt: 1 }),
                dinner({
                    text: 'Menu',
                    amountCents: 3000,
                    shares: [
                        { memberId: 'ana', cents: 1000 },
                        { memberId: 'bea', cents: 2000 },
                    ],
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    createdAt: 2,
                })
            )
        );

        expect(rows(csv).slice(1, 3)).toEqual([
            '2026-10-25,Hotel,Food,40.00,EUR,Credit card,2026-11-02,20.00,,Trip',
            '2026-10-25,Menu,Food,30.00,EUR,Restaurant card,2026-11-12,10.00,,Trip',
        ]);
    });

    it('leaves the card of the payer out of the row of somebody else', () => {
        const csv = csvOf('en', ledger(group({ me: 'bea' }), dinner({ payment: 'credit', chargeDate: '2026-11-02' })));

        expect(rows(csv)[1]).toBe('2026-10-25,Dinner,Food,40.00,EUR,Now,,20.00,,Trip');
    });

    it('is a row in the order of the others, among the expenses of your own', () => {
        const [row] = partsOf(ledger(group(), dinner({ text: 'Shared', date: '2026-10-24', createdAt: 5 })));
        const csv = expensesCsv(
            [expense({ text: 'Later', date: '2026-10-26' }), row!, expense({ text: 'Earlier', date: '2026-10-20' })],
            'en',
            LABELS
        );

        const lines = rows(csv).slice(1, 4);
        expect(lines.map((line) => line.split(',')[1])).toEqual(['Earlier', 'Shared', 'Later']);
        expect(lines.map((line) => line.split(',').at(-1))).toEqual(['', 'Trip', '']);
    });

    it('names a friend by the person', () => {
        const dani = group({
            id: DANI_ID,
            kind: 'direct',
            name: null,
            members: [member('ana', 'Ana'), member('dani', 'Dani')],
        });

        const csv = csvOf('en', ledger(dani, dinner()));

        expect(rows(csv)[1]!.split(',').at(-1)).toBe('Dani');
    });

    it('gives no row for a settlement, for an expense you are not in or for a deleted one', () => {
        const csv = csvOf(
            'en',
            ledger(
                group(),
                settlement(),
                dinner({ amountCents: 2000, shares: [{ memberId: 'bea', cents: 2000 }] }),
                dinner({ deletedAt: 9_000 })
            )
        );

        expect(rows(csv)).toHaveLength(2);
    });

    it('gives no row for a group whose switch is off', () => {
        expect(rows(csvOf('en', ledger(group({ showInExpenses: false }), dinner())))).toHaveLength(2);
    });

    it('writes the amounts and the delimiter of the language, as for the rows of your own', () => {
        const big = dinner({
            amountCents: 12_345_678,
            shares: [
                { memberId: 'ana', cents: 10_000_000 },
                { memberId: 'bea', cents: 2_345_678 },
            ],
        });

        const csv = csvOf('es', ledger(group({ me: 'bea' }), big));

        expect(rows(csv)[1]).toBe('2026-10-25;Dinner;Comida;123456,78;EUR;Ahora;;23456,78;;Viaje');
    });

    describe('the name of the group', () => {
        const lineWith = (name: string, locale: 'en' | 'es' = 'en') => {
            const labels = locale === 'en' ? LABELS : LABELS_ES;
            return expensesCsv(partsOf(ledger(group(), dinner())), locale, { ...labels, groupName: () => name });
        };

        it('is quoted, with its quotes doubled, when it holds the delimiter or a quote', () => {
            expect(rows(lineWith('Trip, "Lisbon"'))[1]).toMatch(/,"Trip, ""Lisbon"""$/);
            expect(rows(lineWith('Pan; leche', 'es'))[1]).toMatch(/;"Pan; leche"$/);
        });

        it('is quoted, with the line break kept inside, when it has one', () => {
            const csv = lineWith('Two\nlines');

            expect(csv).toContain(',"Two\nlines"\r\n');
            expect(rows(csv)).toHaveLength(3);
        });

        it('is guarded, so a spreadsheet never runs it', () => {
            expect(rows(lineWith('=cmd|calc'))[1]).toMatch(/,'=cmd\|calc$/);
        });
    });
});

describe('exportFileName', () => {
    it('is tarja and the day of the device', () => {
        expect(exportFileName(new Date(2026, 9, 25, 23, 59), 'json')).toBe('tarja-2026-10-25.json');
    });

    it('pads the month and the day', () => {
        expect(exportFileName(new Date(2026, 0, 5, 0, 1), 'csv')).toBe('tarja-2026-01-05.csv');
    });
});
