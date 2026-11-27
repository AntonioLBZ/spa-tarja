import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { EXPENSES_KEY, groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { ana, bea, BOM, type Download, expense, GYM, halves, open, readBlob, trip } from '@/lib/testing/your-data';

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
        const app = renderApp({ path: '/settings/account' });
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
        const app = renderApp({ path: '/settings/account' });
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
