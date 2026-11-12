import { QueryClient, dehydrate, onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { BUDGETS_KEY, CATEGORIES_KEY, EXPENSES_KEY, GROUPS_KEY, INCOME_KEY, groupEntriesKey } from '@/lib/api';
import { PERSIST_BUSTER, createPersister, createUserStorage } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { leaveCopy, person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { Category } from '@core/category';
import type { Expense } from '@core/expense';
import type { SharedGroup } from '@core/shared-group';

const BOM = '﻿';

const GYM: Category = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' };

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');

function trip(overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ name: 'Trip', members: [ana, bea], me: ana.id, ...overrides });
}

function halves(cents: number) {
    return [
        { memberId: ana.id, cents },
        { memberId: bea.id, cents },
    ];
}

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-10-24',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

interface Download {
    name: string;
    type: string;
    text: string;
}

let downloads: Download[];

async function readBlob(blob: Blob): Promise<string> {
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
}

async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi(options);
    const fetchMock = stubApi(api.handler);
    const app = renderApp({ path: '/settings' });
    await screen.findByRole('heading', { name: en.settings.data.title });
    await waitFor(() => {
        expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(INCOME_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(BUDGETS_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success');
        for (const group of options.groups ?? []) {
            expect(app.queryClient.getQueryState(groupEntriesKey(group.id))?.status).toBe('success');
        }
    });
    return { api, app, fetchMock };
}

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
    it('is a section between the categories and the account, with a hint and two buttons', async () => {
        await open();

        const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
        expect(headings).toEqual([
            en.settings.profile.title,
            en.settings.categories.title,
            en.settings.data.title,
            en.settings.account.title,
            en.settings.about.title,
        ]);
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
        const app = renderApp({ path: '/settings', storage });
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

describe('the CSV file', () => {
    it('downloads tarja and the day, as CSV in UTF-8 with a byte order mark', async () => {
        await open({ expenses: [expense({ text: 'Lunch' })] });

        const file = await press(en.settings.data.csv);

        expect(file.name).toBe('tarja-2026-10-25.csv');
        expect(file.type).toBe('text/csv;charset=utf-8');
        expect(file.text.startsWith(BOM)).toBe(true);
    });

    it('has the header and the names in English, commas and a decimal point', async () => {
        await open({
            expenses: [
                expense({ text: 'Lunch', amountCents: 1250, createdAt: 1 }),
                expense({ text: 'Month', categoryId: GYM.id, amountCents: 3000, createdAt: 2 }),
                expense({
                    text: 'Dinner',
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    personalCents: 600,
                    createdAt: 3,
                }),
            ],
            categories: [GYM],
        });

        const file = await press(en.settings.data.csv);

        const c = en.settings.data.columns;
        expect(file.text.slice(BOM.length).split('\r\n')).toEqual([
            [
                c.date,
                c.text,
                c.category,
                c.amount,
                c.currency,
                c.payment,
                c.chargeDate,
                c.personal,
                c.part,
                c.group,
            ].join(','),
            `2026-10-24,Lunch,${en.categories.food},12.50,EUR,${en.expenses.payment.direct},,,,`,
            `2026-10-24,Month,Gym,30.00,EUR,${en.expenses.payment.direct},,,,`,
            `2026-10-24,Dinner,${en.categories.food},12.50,EUR,${en.expenses.payment.voucher},2026-11-12,6.00,,`,
            '',
        ]);
    });

    it('has the header and the names in Spanish, semicolons and a decimal comma', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const api = createFakeApi({ expenses: [expense({ text: 'Almuerzo', amountCents: 1250 })] });
        stubApi(api.handler);
        const app = renderApp({ path: '/settings' });
        await screen.findByRole('heading', { name: es.settings.data.title });
        await waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));

        const file = await press(es.settings.data.csv);

        const c = es.settings.data.columns;
        expect(file.text.slice(BOM.length).split('\r\n')).toEqual([
            [
                c.date,
                c.text,
                c.category,
                c.amount,
                c.currency,
                c.payment,
                c.chargeDate,
                c.personal,
                c.part,
                c.group,
            ].join(';'),
            `2026-10-24;Almuerzo;${es.categories.food};12,50;EUR;${es.expenses.payment.direct};;;;`,
            '',
        ]);
    });

    it('numbers the payments of a plan and keeps a spreadsheet from running a text', async () => {
        const plan = crypto.randomUUID();
        await open({
            expenses: [
                expense({ text: '=1+1', createdAt: 1 }),
                expense({
                    text: 'Sofa',
                    createdAt: 2,
                    chargeDate: '2026-10-24',
                    plan: { id: plan, part: 1, parts: 2 },
                }),
                expense({
                    text: 'Sofa',
                    createdAt: 2,
                    chargeDate: '2026-11-24',
                    plan: { id: plan, part: 2, parts: 2 },
                }),
            ],
        });

        const file = await press(en.settings.data.csv);

        const lines = file.text.slice(BOM.length).split('\r\n');
        expect(lines[1]!.split(',')[1]).toBe("'=1+1");
        expect(lines.slice(2, 4).map((line) => line.split(',').at(-2))).toEqual(['1/2', '2/2']);
    });

    it('lists what is waiting to be sent and not what was deleted', async () => {
        const { app } = await open({
            expenses: [expense({ text: 'Synced' }), expense({ text: 'Gone', deletedAt: 5 })],
        });
        await app.outbox.put(expense({ text: 'Waiting', date: '2026-10-25' }));

        const file = await press(en.settings.data.csv);

        expect(file.text).toContain('Synced');
        expect(file.text).toContain('Waiting');
        expect(file.text).not.toContain('Gone');
    });
});

describe('the shared expenses in the CSV file', () => {
    const lines = (text: string) => text.slice(BOM.length).split('\r\n');

    const csvOf = async (options: Parameters<typeof createFakeApi>[0]) => {
        await open(options);
        return press(en.settings.data.csv);
    };

    it('has your part of each shared expense with the group, the total and how the payer paid', async () => {
        const group = trip();

        const file = await csvOf({
            expenses: [expense({ text: 'Lunch', date: '2026-10-24', createdAt: 1 })],
            groups: [group],
            entries: [
                sampleEntry(group, { text: 'Dinner', paidBy: bea.id, shares: halves(2000), createdAt: 1 }),
                sampleEntry(group, {
                    text: 'Hotel',
                    amountCents: 10_000,
                    shares: halves(5000),
                    payment: 'credit',
                    chargeDate: '2026-11-24',
                    createdAt: 2,
                }),
            ],
        });

        const c = en.settings.data.columns;
        expect(file.name).toBe('tarja-2026-10-25.csv');
        expect(lines(file.text)).toEqual([
            [
                c.date,
                c.text,
                c.category,
                c.amount,
                c.currency,
                c.payment,
                c.chargeDate,
                c.personal,
                c.part,
                c.group,
            ].join(','),
            `2026-10-24,Lunch,${en.categories.food},12.50,EUR,${en.expenses.payment.direct},,,,`,
            `2026-10-25,Dinner,${en.categories.food},40.00,EUR,${en.expenses.payment.direct},,20.00,,Trip`,
            `2026-10-25,Hotel,${en.categories.food},100.00,EUR,${en.expenses.payment.credit},2026-11-24,50.00,,Trip`,
            '',
        ]);
    });

    it('names a friend by the person', async () => {
        const dani = sampleGroup({ kind: 'direct', name: null, members: [ana, person('Dani')], me: ana.id });

        const file = await csvOf({ groups: [dani], entries: [sampleEntry(dani, { text: 'Coffee' })] });

        expect(lines(file.text)[1]!.split(',').at(-1)).toBe('Dani');
    });

    it('has the rows of a closed group, and none of a group whose switch is off', async () => {
        const closed = trip({ closed: 'deleted', name: 'Closed' });
        const off = trip({ showInExpenses: false, name: 'Off' });

        const file = await csvOf({
            groups: [closed, off],
            entries: [sampleEntry(closed, { text: 'Old trip' }), sampleEntry(off, { text: 'Hidden' })],
        });

        expect(file.text).toContain('Old trip');
        expect(file.text).toContain(',Closed');
        expect(file.text).not.toContain('Hidden');
        expect(lines(file.text)).toHaveLength(3);
    });

    it('leaves out a settlement, what was deleted and an expense you are not in', async () => {
        const group = trip();

        const file = await csvOf({
            groups: [group],
            entries: [
                sampleEntry(group, { text: 'Kept' }),
                sampleSettlement(group, bea.id, ana.id, 1500),
                sampleEntry(group, { text: 'Gone', deletedAt: 9 }),
                sampleEntry(group, {
                    text: 'Not mine',
                    paidBy: bea.id,
                    shares: [{ memberId: bea.id, cents: 4000 }],
                }),
            ],
        });

        expect(lines(file.text)).toHaveLength(3);
        expect(file.text).toContain('Kept');
        expect(file.text).not.toContain('Gone');
        expect(file.text).not.toContain('Not mine');
    });

    it('counts what a placeholder merged into you was to pay, and the people who left still have their rows', async () => {
        const dummy = person('Cris', { claimed: false, leftAt: 5_000, mergedInto: ana.id });
        const left = person('Dev', { leftAt: 6_000 });
        const group = trip({ members: [ana, left, dummy] });

        const file = await csvOf({
            groups: [group],
            entries: [
                sampleEntry(group, {
                    text: 'Split',
                    paidBy: left.id,
                    shares: [
                        { memberId: dummy.id, cents: 3000 },
                        { memberId: left.id, cents: 1000 },
                    ],
                }),
            ],
        });

        expect(lines(file.text)[1]).toBe(
            `2026-10-25,Split,${en.categories.food},40.00,EUR,${en.expenses.payment.direct},,30.00,,Trip`
        );
    });

    it('quotes a text and a group name with commas, quotes and line breaks, and guards a formula', async () => {
        const named = trip({ name: 'Trip, "Lisbon"\nday 2' });
        const formula = trip({ name: '=1+1' });

        const file = await csvOf({
            groups: [named, formula],
            entries: [
                sampleEntry(named, { text: 'Bread, "fresh"\nbaker', createdAt: 1 }),
                sampleEntry(formula, { text: 'Plain', createdAt: 2 }),
            ],
        });

        expect(file.text).toContain('"Bread, ""fresh""\nbaker"');
        expect(file.text).toContain(',"Trip, ""Lisbon""\nday 2"\r\n');
        expect(file.text).toContain(",'=1+1\r\n");
    });

    it('is written in Spanish with semicolons and a decimal comma', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const group = trip({ name: 'Viaje' });
        stubApi(
            createFakeApi({ groups: [group], entries: [sampleEntry(group, { text: 'Cena', shares: halves(2000) })] })
                .handler
        );
        const app = renderApp({ path: '/settings' });
        await screen.findByRole('heading', { name: es.settings.data.title });
        await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(group.id))?.status).toBe('success'));

        const file = await press(es.settings.data.csv);

        const c = es.settings.data.columns;
        expect(lines(file.text)).toEqual([
            [
                c.date,
                c.text,
                c.category,
                c.amount,
                c.currency,
                c.payment,
                c.chargeDate,
                c.personal,
                c.part,
                c.group,
            ].join(';'),
            `2026-10-25;Cena;${es.categories.food};40,00;EUR;${es.expenses.payment.direct};;20,00;;Viaje`,
            '',
        ]);
    });
});

describe('while the groups are loading', () => {
    const json = () => screen.getByRole('button', { name: en.settings.data.json }) as HTMLButtonElement;
    const csv = () => screen.getByRole('button', { name: en.settings.data.csv }) as HTMLButtonElement;

    const settings = async (app: ReturnType<typeof renderApp>) => {
        await screen.findByRole('heading', { name: en.settings.data.title });
        await waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
    };

    it('waits for the groups, with both buttons off and a notice that says what for', async () => {
        const group = trip();
        const api = createFakeApi({ groups: [group], entries: [sampleEntry(group, { text: 'Dinner' })] });
        stubApi(api.handler);
        const release = api.hold();
        renderApp({ path: '/settings' });
        await screen.findByRole('heading', { name: en.settings.data.title });

        expect(screen.getByText(en.settings.data.loading).getAttribute('role')).toBe('status');
        expect(json().disabled).toBe(true);
        expect(csv().disabled).toBe(true);

        release();

        await waitFor(() => expect(json().disabled).toBe(false));
        expect(csv().disabled).toBe(false);
        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        const file = await press(en.settings.data.json);
        expect(JSON.parse(file.text).groups).toHaveLength(1);
    });

    it('waits for the entries of a group too', async () => {
        const group = trip();
        const api = createFakeApi({ groups: [group], entries: [sampleEntry(group, { text: 'Dinner' })] });
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        stubApi(async (url, init) => {
            if (url.pathname.endsWith('/entries')) await gate;
            return api.handler(url, init);
        });
        const app = renderApp({ path: '/settings' });
        await settings(app);
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));

        expect(screen.getByText(en.settings.data.loading)).toBeDefined();
        expect(csv().disabled).toBe(true);

        release();

        await waitFor(() => expect(csv().disabled).toBe(false));
        expect((await press(en.settings.data.csv)).text).toContain('Dinner');
    });

    const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

    const stall = async (path: (pathname: string) => boolean, options: Parameters<typeof createFakeApi>[0]) => {
        const api = createFakeApi(options);
        stubApi((url, init) => {
            if (path(url.pathname)) return new Promise<Response>(() => undefined);
            return api.handler(url, init);
        });
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        const app = renderApp({ path: '/settings' });
        await advance(1_000);
        await vi.waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
    };

    it('stops waiting after ten seconds for a request that never answers, and says what is left out', async () => {
        await stall((pathname) => pathname.endsWith('/entries'), {
            expenses: [expense({ text: 'Mine' })],
            groups: [trip()],
        });

        expect(screen.getByText(en.settings.data.loading)).toBeDefined();
        expect(csv().disabled).toBe(true);

        await advance(5_000);

        expect(csv().disabled).toBe(true);

        await advance(6_000);

        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        expect(screen.getByText(en.settings.data.missing).getAttribute('role')).toBe('status');
        expect(json().disabled).toBe(false);
        expect(csv().disabled).toBe(false);

        vi.useRealTimers();
        const backup = JSON.parse((await press(en.settings.data.json)).text);
        expect(backup.groups).toEqual([]);
        expect(backup.expenses).toHaveLength(1);
    });

    it('stops waiting after ten seconds for the groups too', async () => {
        await stall((pathname) => pathname === '/api/groups', {
            expenses: [expense({ text: 'Mine' })],
            groups: [trip()],
        });

        expect(json().disabled).toBe(true);

        await advance(11_000);

        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        expect(json().disabled).toBe(false);
        expect(csv().disabled).toBe(false);
    });

    it('leaves out a group whose expenses cannot be had, says so, and exports the rest', async () => {
        const lost = trip({ name: 'Lost' });
        const found = trip({ name: 'Found' });
        const api = createFakeApi({
            expenses: [expense({ text: 'Mine' })],
            groups: [lost, found],
            entries: [sampleEntry(lost, { text: 'Lost dinner' }), sampleEntry(found, { text: 'Found dinner' })],
        });
        stubApi((url, init) => {
            if (url.pathname === `/api/groups/${lost.id}/entries`) throw new TypeError('Failed to fetch');
            return api.handler(url, init);
        });
        const app = renderApp({ path: '/settings' });
        await settings(app);
        await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(lost.id))?.status).toBe('error'));
        await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(found.id))?.status).toBe('success'));

        expect(screen.getByText(en.settings.data.missing).getAttribute('role')).toBe('status');
        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        const backup = JSON.parse((await press(en.settings.data.json)).text);
        const sheet = (await press(en.settings.data.csv)).text;

        expect(backup.groups.map((item: SharedGroup) => item.name)).toEqual(['Found']);
        expect(backup.expenses).toHaveLength(1);
        expect(sheet).toContain('Found dinner');
        expect(sheet).not.toContain('Lost dinner');
    });

    it('says the same offline, when the device holds a group but never pulled its expenses', async () => {
        const group = trip();
        const storage = createMemoryStorage();
        const source = new QueryClient();
        source.setQueryData(GROUPS_KEY, [group]);
        await createPersister(createUserStorage(storage, TEST_USER.id).storage).persistClient({
            timestamp: Date.now(),
            buster: PERSIST_BUSTER,
            clientState: dehydrate(source),
        });
        onlineManager.setOnline(false);
        stubApi(createFakeApi({ groups: [group] }).handler);
        renderApp({ path: '/settings', storage });
        await screen.findByRole('heading', { name: en.settings.data.title });

        await screen.findByText(en.settings.data.missing);

        expect(json().disabled).toBe(false);
        expect(JSON.parse((await press(en.settings.data.json)).text).groups).toEqual([]);
    });

    it('says nothing when the device never heard of its groups, and exports what it has', async () => {
        const api = createFakeApi({ expenses: [expense({ text: 'Mine' })], groups: [trip()] });
        stubApi((url, init) => {
            if (url.pathname === '/api/groups') throw new TypeError('Failed to fetch');
            return api.handler(url, init);
        });
        const app = renderApp({ path: '/settings' });
        await settings(app);
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('error'));

        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        expect(screen.queryByText(en.settings.data.missing)).toBeNull();
        const backup = JSON.parse((await press(en.settings.data.json)).text);
        expect(backup.groups).toEqual([]);
        expect(backup.expenses).toHaveLength(1);
    });

    it('works from the copy the device kept, offline from the start', async () => {
        const storage = createMemoryStorage();
        const group = trip();
        await leaveCopy(storage, [group], [sampleEntry(group, { text: 'Dinner', shares: halves(2000) })]);
        onlineManager.setOnline(false);
        const api = createFakeApi({ groups: [group] });
        api.state.offline = true;
        stubApi(api.handler);
        const app = renderApp({ path: '/settings', storage });
        await screen.findByRole('heading', { name: en.settings.data.title });
        await waitFor(() => expect(app.queryClient.getQueryData(groupEntriesKey(group.id))).toBeDefined());

        expect(json().disabled).toBe(false);
        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        expect(screen.queryByText(en.settings.data.missing)).toBeNull();
        expect((await press(en.settings.data.csv)).text).toContain('Dinner');
        expect(JSON.parse((await press(en.settings.data.json)).text).groups).toHaveLength(1);
    });
});

describe('offline', () => {
    it('makes both files from the local copy and sends nothing, with the server out of reach', async () => {
        const { api, fetchMock } = await open({
            expenses: [expense({ text: 'Lunch' })],
            categories: [GYM],
            budgets: [{ month: '2026-10', scope: 'food', amountCents: 30_000, currency: 'EUR' }],
        });
        api.state.offline = true;
        onlineManager.setOnline(false);
        const calls = fetchMock.mock.calls.length;
        const requests = api.requests.length;

        const json = await press(en.settings.data.json);
        const csv = await press(en.settings.data.csv);

        expect(JSON.parse(json.text).expenses).toHaveLength(1);
        expect(JSON.parse(json.text).budgets).toHaveLength(1);
        expect(csv.text).toContain('Lunch');
        expect(fetchMock.mock.calls).toHaveLength(calls);
        expect(api.requests).toHaveLength(requests);
        expect(api.writes).toHaveLength(0);
    });

    it('makes both files with the groups from the local copy, and sends nothing', async () => {
        const group = trip();
        const { api, fetchMock } = await open({
            groups: [group],
            entries: [sampleEntry(group, { text: 'Dinner', shares: halves(2000) })],
        });
        api.state.offline = true;
        onlineManager.setOnline(false);
        const calls = fetchMock.mock.calls.length;
        const requests = api.requests.length;

        const json = await press(en.settings.data.json);
        const csv = await press(en.settings.data.csv);

        expect(JSON.parse(json.text).groups[0].entries).toHaveLength(1);
        expect(csv.text).toContain('Dinner');
        expect(fetchMock.mock.calls).toHaveLength(calls);
        expect(api.requests).toHaveLength(requests);
        expect(api.writes).toHaveLength(0);
    });

    it('opens the settings and presses nothing without writing anything to the server', async () => {
        const { api } = await open({ expenses: [expense()] });

        expect(api.requests.every((request) => request.startsWith('GET '))).toBe(true);
        expect(api.attempts).toHaveLength(0);
    });
});
