import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { BUDGETS_KEY, CATEGORIES_KEY, EXPENSES_KEY, INCOME_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { Category } from '@core/category';
import type { Expense } from '@core/expense';

const BOM = '﻿';

const GYM: Category = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' };

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
        expect(headings).toEqual([en.settings.categories.title, en.settings.data.title, en.settings.account.title]);
        expect(screen.getByText(en.settings.data.description)).toBeDefined();
        expect(screen.getByRole('button', { name: en.settings.data.backup }).getAttribute('type')).toBe('button');
        expect(screen.getByRole('button', { name: en.settings.data.spreadsheet }).getAttribute('type')).toBe('button');
    });

    it('is always on, with nothing to confirm', async () => {
        await open();

        expect((screen.getByRole('button', { name: en.settings.data.backup }) as HTMLButtonElement).disabled).toBe(
            false
        );
        expect((screen.getByRole('button', { name: en.settings.data.spreadsheet }) as HTMLButtonElement).disabled).toBe(
            false
        );
    });
});

describe('the backup', () => {
    it('downloads tarja and the day, as JSON, with the expenses, the custom categories, the income and the budgets', async () => {
        const lunch = expense({ text: 'Lunch', categoryId: GYM.id });
        await open({
            expenses: [lunch, expense({ text: 'Gone', deletedAt: 5_000 })],
            categories: [GYM],
            income: [{ month: '2026-10', amountCents: 200_000, currency: 'EUR' }],
            budgets: [{ month: '2026-10', scope: 'food', amountCents: 30_000, currency: 'EUR' }],
        });

        const file = await press(en.settings.data.backup);

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
        });
    });

    it('holds what is still waiting to be sent, on top of what the server told this device', async () => {
        const { app } = await open({ expenses: [expense({ text: 'Synced' })] });
        onlineManager.setOnline(false);
        await app.outbox.put(expense({ text: 'Waiting', date: '2026-10-25' }));

        const file = await press(en.settings.data.backup);

        expect(JSON.parse(file.text).expenses.map((item: Expense) => item.text)).toEqual(['Synced', 'Waiting']);
    });

    it('leaves out an expense deleted on this device that the server has not heard of yet', async () => {
        const lunch = expense({ text: 'Lunch' });
        const { app } = await open({ expenses: [lunch] });
        onlineManager.setOnline(false);
        await app.outbox.put({ ...lunch, updatedAt: 9_000, deletedAt: 9_000 });

        const file = await press(en.settings.data.backup);

        expect(JSON.parse(file.text).expenses).toEqual([]);
    });
});

describe('the spreadsheet', () => {
    it('downloads tarja and the day, as CSV in UTF-8 with a byte order mark', async () => {
        await open({ expenses: [expense({ text: 'Lunch' })] });

        const file = await press(en.settings.data.spreadsheet);

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

        const file = await press(en.settings.data.spreadsheet);

        const c = en.settings.data.columns;
        expect(file.text.slice(BOM.length).split('\r\n')).toEqual([
            [c.date, c.text, c.category, c.amount, c.currency, c.payment, c.chargeDate, c.personal, c.part].join(','),
            `2026-10-24,Lunch,${en.categories.food},12.50,EUR,${en.expenses.payment.direct},,,`,
            `2026-10-24,Month,Gym,30.00,EUR,${en.expenses.payment.direct},,,`,
            `2026-10-24,Dinner,${en.categories.food},12.50,EUR,${en.expenses.payment.voucher},2026-11-12,6.00,`,
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

        const file = await press(es.settings.data.spreadsheet);

        const c = es.settings.data.columns;
        expect(file.text.slice(BOM.length).split('\r\n')).toEqual([
            [c.date, c.text, c.category, c.amount, c.currency, c.payment, c.chargeDate, c.personal, c.part].join(';'),
            `2026-10-24;Almuerzo;${es.categories.food};12,50;EUR;${es.expenses.payment.direct};;;`,
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

        const file = await press(en.settings.data.spreadsheet);

        const lines = file.text.slice(BOM.length).split('\r\n');
        expect(lines[1]!.split(',')[1]).toBe("'=1+1");
        expect(lines.slice(2, 4).map((line) => line.split(',').at(-1))).toEqual(['1/2', '2/2']);
    });

    it('lists what is waiting to be sent and not what was deleted', async () => {
        const { app } = await open({
            expenses: [expense({ text: 'Synced' }), expense({ text: 'Gone', deletedAt: 5 })],
        });
        await app.outbox.put(expense({ text: 'Waiting', date: '2026-10-25' }));

        const file = await press(en.settings.data.spreadsheet);

        expect(file.text).toContain('Synced');
        expect(file.text).toContain('Waiting');
        expect(file.text).not.toContain('Gone');
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

        const json = await press(en.settings.data.backup);
        const csv = await press(en.settings.data.spreadsheet);

        expect(JSON.parse(json.text).expenses).toHaveLength(1);
        expect(JSON.parse(json.text).budgets).toHaveLength(1);
        expect(csv.text).toContain('Lunch');
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
