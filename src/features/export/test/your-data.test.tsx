import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { EXPENSES_KEY, groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { TEST_USER } from '@/lib/testing/fake-auth';
import { leaveCopy, person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/testing/groups';
import { createMemoryStorage } from '@/lib/testing/memory-storage';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { ana, bea, type Download, expense, GYM, halves, open, readBlob, trip } from '@/lib/testing/your-data';

import type { Expense } from '@core/expenses/expense';
import type { SharedGroup } from '@core/groups/shared-group';

let downloads: Download[];

async function press(name: string) {
    const before = downloads.length;
    fireEvent.click(screen.getByRole('button', { name }));
    await waitFor(() => expect(downloads.length).toBe(before + 1));
    return downloads.at(-1)!;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    downloads = [];
    const pending: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: (blob: Blob) => {
            pending.push(blob);
            return `blob:tarja-${pending.length}`;
        },
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        const blob = pending[Number(this.href.split('-').at(-1)) - 1]!;
        void readBlob(blob).then((text) => downloads.push({ name: this.download, type: blob.type, text }));
    });
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
});

describe('your data in the settings', () => {
    it('is a section of the page of the account, between the profile and the session, with a hint and two buttons', async () => {
        await open();

        const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
        expect(headings).toEqual([en.settings.profile.title, en.settings.data.title, en.settings.account.session]);
        expect(screen.getByText(en.settings.data.description)).toBeDefined();
        expect(screen.getByRole('button', { name: en.settings.data.json }).getAttribute('type')).toBe('button');
        expect(screen.getByRole('button', { name: en.settings.data.csv }).getAttribute('type')).toBe('button');
    });

    it('is always on, with nothing to confirm', async () => {
        await open();

        expect((screen.getByRole('button', { name: en.settings.data.json }) as HTMLButtonElement).disabled).toBe(false);
        expect((screen.getByRole('button', { name: en.settings.data.csv }) as HTMLButtonElement).disabled).toBe(false);
    });
});

describe('the JSON file', () => {
    it('downloads tarja and the day, as JSON, with the expenses, the custom categories, the income and the budgets', async () => {
        const lunch = expense({ text: 'Lunch', categoryId: GYM.id });
        await open({
            expenses: [lunch, expense({ text: 'Gone', deletedAt: 5_000 })],
            categories: [GYM],
            income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }],
            budgets: [{ month: '2026-10', scope: 'food', amountCents: 30_000, currency: 'EUR' }],
        });

        const file = await press(en.settings.data.json);

        expect(file.name).toBe('tarja-2026-10-25.json');
        expect(file.type).toBe('application/json');
        expect(JSON.parse(file.text)).toEqual({
            app: 'tarja',
            version: 1,
            exportedAt: new Date(2026, 9, 25, 12).toISOString(),
            expenses: [lunch],
            categories: [GYM],
            income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }],
            budgets: [{ month: '2026-10', scope: 'food', amountCents: 30_000, currency: 'EUR' }],
            groups: [],
        });
    });

    it('holds what is still waiting to be sent, on top of what the server told this device', async () => {
        const { app } = await open({ expenses: [expense({ text: 'Synced' })] });
        onlineManager.setOnline(false);
        await app.outbox.put(expense({ text: 'Waiting', date: '2026-10-25' }));

        const file = await press(en.settings.data.json);

        expect(JSON.parse(file.text).expenses.map((item: Expense) => item.text)).toEqual(['Synced', 'Waiting']);
    });

    it('holds only your own expenses, never your part of a shared one', async () => {
        const storage = createMemoryStorage();
        const group = sampleGroup();
        await leaveCopy(storage, [group], [sampleEntry(group, { text: 'Shared dinner' })]);
        stubApi(createFakeApi({ expenses: [expense({ text: 'Mine' })], groups: [group] }).handler);
        const app = renderApp({ path: '/settings/account', storage });
        await screen.findByRole('heading', { name: en.settings.data.title });
        await waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
        expect(app.queryClient.getQueryData(groupEntriesKey(group.id))).toBeDefined();

        const file = await press(en.settings.data.json);

        expect(JSON.parse(file.text).expenses.map((item: Expense) => item.text)).toEqual(['Mine']);
    });

    it('leaves out an expense deleted on this device that the server has not heard of yet', async () => {
        const lunch = expense({ text: 'Lunch' });
        const { app } = await open({ expenses: [lunch] });
        onlineManager.setOnline(false);
        await app.outbox.put({ ...lunch, updatedAt: 9_000, deletedAt: 9_000 });

        const file = await press(en.settings.data.json);

        expect(JSON.parse(file.text).expenses).toEqual([]);
    });
});

describe('the groups in the JSON file', () => {
    const backupOf = async (options: Parameters<typeof createFakeApi>[0]) => {
        await open(options);
        const file = await press(en.settings.data.json);
        return { file, backup: JSON.parse(file.text) };
    };

    it('holds each group with its people and its entries, and never a shared row among the expenses', async () => {
        const group = trip();
        const dinner = sampleEntry(group, { text: 'Dinner', shares: halves(2000) });
        const paid = { ...sampleSettlement(group, bea.id, ana.id, 1500), date: '2026-10-26' };

        const { file, backup } = await backupOf({
            expenses: [expense({ text: 'Mine' })],
            groups: [group],
            entries: [paid, dinner],
        });

        expect(file.name).toBe('tarja-2026-10-25.json');
        expect(backup.expenses.map((item: Expense) => item.text)).toEqual(['Mine']);
        expect(backup.groups).toHaveLength(1);
        expect(backup.groups[0]).toMatchObject({
            id: group.id,
            kind: 'group',
            name: 'Trip',
            currency: 'EUR',
            simplifyDebts: false,
            closed: null,
            archived: false,
            showInExpenses: true,
            pinned: false,
            me: ana.id,
            members: group.members,
        });
        const [first, second] = backup.groups[0].entries;
        expect(first).toMatchObject({
            id: dinner.id,
            kind: 'expense',
            text: 'Dinner',
            amountCents: 4000,
            paidBy: ana.id,
            shares: halves(2000),
            createdBy: ana.id,
            updatedBy: ana.id,
        });
        expect(second).toMatchObject({ id: paid.id, kind: 'settlement', paidBy: bea.id, categoryId: null });
        expect(Object.keys(first)).not.toContain('groupId');
    });

    it('holds a group whose switch is off, a closed one and a friend, in the order the server lists them', async () => {
        const off = trip({ showInExpenses: false, name: 'Off' });
        const closed = trip({ closed: 'deleted', archived: true, name: 'Closed' });
        const dani = sampleGroup({ kind: 'direct', name: null, members: [ana, person('Dani')], me: ana.id });

        const { backup } = await backupOf({
            groups: [off, closed, dani],
            entries: [sampleEntry(off), sampleEntry(closed)],
        });

        expect(backup.groups.map((item: SharedGroup) => [item.id, item.name, item.kind])).toEqual([
            [off.id, 'Off', 'group'],
            [closed.id, 'Closed', 'group'],
            [dani.id, null, 'direct'],
        ]);
        expect(backup.groups.map((item: SharedGroup) => [item.showInExpenses, item.closed, item.archived])).toEqual([
            [false, null, false],
            [true, 'deleted', true],
            [true, null, false],
        ]);
        expect(backup.groups.map((item: { entries: unknown[] }) => item.entries.length)).toEqual([1, 1, 0]);
    });

    it('holds a member who left and a placeholder merged into somebody as the group tells them', async () => {
        const left = person('Bea', { leftAt: 6_000 });
        const dummy = person('Cris', { claimed: false, leftAt: 5_000, mergedInto: ana.id });
        const group = trip({ members: [ana, left, dummy] });

        const { backup } = await backupOf({
            groups: [group],
            entries: [sampleEntry(group, { shares: [{ memberId: dummy.id, cents: 4000 }] })],
        });

        expect(backup.groups[0].members).toEqual([ana, left, dummy]);
        expect(backup.groups[0].entries[0].shares).toEqual([{ memberId: dummy.id, cents: 4000 }]);
    });

    it('holds a group with no entries as an empty list', async () => {
        const group = trip();

        const { backup } = await backupOf({ groups: [group] });

        expect(backup.groups.map((item: SharedGroup) => item.id)).toEqual([group.id]);
        expect(backup.groups[0].entries).toEqual([]);
    });

    it('keeps a name with a comma, a quote or a line break as it is', async () => {
        const group = trip({ name: 'Trip, "Lisbon"\nday 2' });

        const { backup } = await backupOf({
            groups: [group],
            entries: [sampleEntry(group, { text: 'Bread, "fresh"\nbaker' })],
        });

        expect(backup.groups[0].name).toBe('Trip, "Lisbon"\nday 2');
        expect(backup.groups[0].entries[0].text).toBe('Bread, "fresh"\nbaker');
    });

    it('leaves out the entries that were deleted', async () => {
        const group = trip();

        const { backup } = await backupOf({
            groups: [group],
            entries: [sampleEntry(group, { text: 'Kept' }), sampleEntry(group, { text: 'Gone', deletedAt: 9 })],
        });

        expect(backup.groups[0].entries.map((entry: { text: string }) => entry.text)).toEqual(['Kept']);
    });

    it('holds what is waiting to be sent in a group', async () => {
        const group = trip();
        const { app } = await open({ groups: [group], entries: [sampleEntry(group, { text: 'Synced' })] });
        onlineManager.setOnline(false);
        await app.groupOutbox.put(sampleEntry(group, { text: 'Waiting', shares: halves(2000), createdAt: 5 }));

        const file = await press(en.settings.data.json);

        expect(JSON.parse(file.text).groups[0].entries.map((entry: { text: string }) => entry.text)).toEqual([
            'Synced',
            'Waiting',
        ]);
    });

    it('has no email and no user id of anybody, in either file', async () => {
        const leaky = { ...ana, email: 'planted@example.com', userId: 'user-planted-1' };
        const group = trip({ members: [leaky, bea] });
        const entry = { ...sampleEntry(group), createdByUser: 'user-planted-1', email: 'planted@example.com' };
        await open({ groups: [group], entries: [entry] });

        const json = await press(en.settings.data.json);
        const csv = await press(en.settings.data.csv);

        for (const file of [json, csv]) {
            for (const secret of ['planted@example.com', 'user-planted-1', TEST_USER.email, TEST_USER.id]) {
                expect(file.text).not.toContain(secret);
            }
        }
        expect(json.text).toContain('"name": "Ana"');
    });
});
