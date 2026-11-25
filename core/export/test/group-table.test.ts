import { describe, expect, it } from 'vitest';

import { groupTable } from '@core/export/group-table';
import { memberBalances } from '@core/groups/balance';

import type { SharedEntry } from '@core/groups/shared-entry';
import type { SharedMember } from '@core/groups/shared-member';

type Expense = Extract<SharedEntry, { kind: 'expense' }>;
type Settlement = Extract<SharedEntry, { kind: 'settlement' }>;

const MEMBERS: SharedMember[] = [
    { id: 'ana', mergedInto: null },
    { id: 'bea', mergedInto: null },
    { id: 'cai', mergedInto: null },
];

const WHOLE = { from: '', to: '' };

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        kind: 'expense',
        text: 'Dinner',
        categoryId: 'food',
        amountCents: 3000,
        currency: 'EUR',
        date: '2026-11-02',
        paidBy: 'ana',
        split: 'equal',
        shares: [
            { memberId: 'ana', cents: 1000 },
            { memberId: 'bea', cents: 1000 },
            { memberId: 'cai', cents: 1000 },
        ],
        payment: 'direct',
        chargeDate: null,
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

function settlement(overrides: Partial<Settlement> = {}): Settlement {
    return {
        id: crypto.randomUUID(),
        kind: 'settlement',
        text: '',
        categoryId: null,
        amountCents: 1000,
        currency: 'EUR',
        date: '2026-11-05',
        paidBy: 'bea',
        split: 'exact',
        shares: [{ memberId: 'ana', cents: 1000 }],
        payment: 'direct',
        chargeDate: null,
        createdAt: 2_000,
        updatedAt: 2_000,
        deletedAt: null,
        ...overrides,
    };
}

describe('groupTable', () => {
    it('gives each member what an entry does to their balance, a settlement included', () => {
        const table = groupTable([expense(), settlement()], MEMBERS, WHOLE);

        expect(table.columns).toEqual(['ana', 'bea', 'cai']);
        expect(table.rows.map((row) => row.cells)).toEqual([
            [2000, -1000, -1000],
            [-1000, 1000, null],
        ]);
        expect(table.opening).toBeNull();
        expect(table.closing).toEqual([1000, 0, -1000]);
    });

    it('closes on the balances the group shows', () => {
        const entries = [
            expense(),
            expense({ paidBy: 'cai', amountCents: 999, shares: [{ memberId: 'ana', cents: 999 }] }),
            settlement(),
        ];
        const table = groupTable(entries, MEMBERS, WHOLE);

        expect(table.closing).toEqual(memberBalances(entries, MEMBERS).map(({ cents }) => cents));
    });

    it('closes on the balances the group shows with a first day and a merged member too', () => {
        const members = [...MEMBERS, { id: 'dummy', mergedInto: 'cai' }];
        const entries = [
            expense({ date: '2026-10-01', paidBy: 'dummy' }),
            expense({
                date: '2026-11-03',
                paidBy: 'bea',
                amountCents: 700,
                shares: [{ memberId: 'dummy', cents: 700 }],
            }),
            settlement({ date: '2026-11-05' }),
        ];
        const table = groupTable(entries, members, { from: '2026-11-01', to: '' });

        expect(table.closing).toEqual(memberBalances(entries, members).map(({ cents }) => cents));
    });

    it('tells a member who is out of an entry from one it leaves even', () => {
        const justAna = expense({ createdAt: 2_000, amountCents: 500, shares: [{ memberId: 'ana', cents: 500 }] });

        expect(groupTable([expense(), justAna], MEMBERS, WHOLE).rows[1]!.cells).toEqual([0, null, null]);
    });

    it('adds what came before the first day into an opening balance', () => {
        const early = expense({ date: '2026-10-20' });
        const inside = settlement({ date: '2026-11-05' });
        const table = groupTable([early, inside], MEMBERS, { from: '2026-11-01', to: '' });

        expect(table.opening).toEqual([2000, -1000, -1000]);
        expect(table.rows.map((row) => row.entry)).toEqual([inside]);
        expect(table.closing).toEqual([1000, 0, -1000]);
    });

    it('leaves out what comes after the last day and what was deleted', () => {
        const kept = expense({ date: '2026-11-02' });
        const later = expense({ date: '2026-11-20' });
        const deleted = expense({ date: '2026-11-03', deletedAt: 5_000 });
        const table = groupTable([later, deleted, kept], MEMBERS, { from: '', to: '2026-11-10' });

        expect(table.rows.map((row) => row.entry)).toEqual([kept]);
    });

    it('orders rows made at the same moment by their id', () => {
        const b = expense({ id: 'bbbbbbbb-0000-4000-8000-000000000000' });
        const a = expense({ id: 'aaaaaaaa-0000-4000-8000-000000000000' });

        expect(groupTable([b, a], MEMBERS, WHOLE).rows.map((row) => row.entry)).toEqual([a, b]);
    });

    it('keeps the last day of the range', () => {
        const last = expense({ date: '2026-11-10' });

        expect(groupTable([last], MEMBERS, { from: '', to: '2026-11-10' }).rows.map((row) => row.entry)).toEqual([
            last,
        ]);
    });

    it('lists the rows by the day made, then when they were made', () => {
        const second = expense({ date: '2026-11-02', createdAt: 9_000 });
        const first = expense({ date: '2026-11-02', createdAt: 1_000 });
        const earliest = expense({ date: '2026-11-01', createdAt: 99_000 });

        expect(groupTable([second, first, earliest], MEMBERS, WHOLE).rows.map((row) => row.entry)).toEqual([
            earliest,
            first,
            second,
        ]);
    });

    it('has a column only for whoever is in a row or holds an opening balance', () => {
        const members = [...MEMBERS, { id: 'dan', mergedInto: null }, { id: 'eva', mergedInto: null }];
        const evened = [
            expense({ date: '2026-10-01', paidBy: 'dan', amountCents: 100, shares: [{ memberId: 'ana', cents: 100 }] }),
            settlement({
                date: '2026-10-02',
                paidBy: 'ana',
                amountCents: 100,
                shares: [{ memberId: 'dan', cents: 100 }],
            }),
        ];
        const owed = expense({
            date: '2026-10-03',
            paidBy: 'eva',
            amountCents: 100,
            shares: [{ memberId: 'bea', cents: 100 }],
        });
        const inside = expense({ date: '2026-11-02', amountCents: 200, shares: [{ memberId: 'cai', cents: 200 }] });

        const table = groupTable([...evened, owed, inside], members, { from: '2026-11-01', to: '' });

        expect(table.columns).toEqual(['ana', 'bea', 'cai', 'eva']);
        expect(table.opening).toEqual([0, -100, 0, 100]);
    });

    it('totals the rows instead of a balance when more than the days narrows them', () => {
        const early = expense({ date: '2026-10-20' });
        const food = expense({
            date: '2026-11-02',
            paidBy: 'bea',
            amountCents: 200,
            shares: [{ memberId: 'cai', cents: 200 }],
        });
        const other = expense({ date: '2026-11-03', categoryId: 'home' });
        const table = groupTable(
            [early, food, other],
            MEMBERS,
            { from: '2026-11-01', to: '' },
            (entry) => entry.categoryId === 'food'
        );

        expect(table.narrowed).toBe(true);
        expect(table.opening).toBeNull();
        expect(table.columns).toEqual(['bea', 'cai']);
        expect(table.rows.map((row) => row.entry)).toEqual([food]);
        expect(table.closing).toEqual([200, -200]);
    });

    it('is empty when the first day comes after the last', () => {
        const entries = [expense({ date: '2026-10-20' }), expense({ date: '2026-11-02' })];

        expect(groupTable(entries, MEMBERS, { from: '2026-11-10', to: '2026-11-01' })).toEqual({
            columns: [],
            opening: null,
            rows: [],
            closing: [],
            narrowed: false,
        });
    });

    it('is not narrowed by the days alone', () => {
        expect(groupTable([expense()], MEMBERS, { from: '2026-11-01', to: '' }).narrowed).toBe(false);
    });

    it('reads a merged member as the one they were merged into', () => {
        const members = [...MEMBERS, { id: 'dummy', mergedInto: 'bea' }];
        const entry = expense({
            paidBy: 'dummy',
            shares: [
                { memberId: 'dummy', cents: 1500 },
                { memberId: 'cai', cents: 1500 },
            ],
        });
        const table = groupTable([entry], members, WHOLE);

        expect(table.columns).toEqual(['bea', 'cai']);
        expect(table.rows[0]!.cells).toEqual([1500, -1500]);
    });
});
