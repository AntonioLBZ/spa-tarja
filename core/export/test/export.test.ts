import { describe, expect, it } from 'vitest';

import { backupJson, buildBackup, exportFileName, type BackupLedger } from '@core/export/export';
import {
    DANI_ID,
    dinner,
    expense,
    group,
    GYM,
    INCOME,
    ledger,
    member,
    NOW,
    partsOf,
    settlement,
    TRIP_ID,
} from '@core/testing/export';

import type { Budget } from '@core/budgets/budget';

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

describe('exportFileName', () => {
    it('is tarja and the day of the device', () => {
        expect(exportFileName(new Date(2026, 9, 25, 23, 59), 'json')).toBe('tarja-2026-10-25.json');
    });

    it('pads the month and the day', () => {
        expect(exportFileName(new Date(2026, 0, 5, 0, 1), 'csv')).toBe('tarja-2026-01-05.csv');
    });
});
