import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createOutbox } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { Expense } from '@core/expense';

const TODAY = '2026-10-25';

const t = createTranslator({ locale: 'en', messages: en });

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

function field(label: string) {
    return screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement;
}

function fillAndSubmit({ amount, text }: { amount: string; text: string }) {
    fireEvent.change(field(en.expenses.form.amount), { target: { value: amount } });
    fireEvent.change(field(en.expenses.form.text), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('expense list', () => {
    it('shows an empty state when there are no expenses', async () => {
        stubApi(createFakeApi().handler);

        renderApp();

        expect(await screen.findByText(en.expenses.list.empty)).toBeDefined();
    });

    it('lists the newest day first, with category and formatted amount', async () => {
        const older = expense({ text: 'Lunch', date: '2026-10-24' });
        const newer = expense({ text: 'Weekly shop', categoryId: 'groceries', amountCents: 4599, date: TODAY });
        stubApi(createFakeApi({ expenses: [older, newer] }).handler);

        renderApp();

        await screen.findByText('Weekly shop');
        const rows = screen.getAllByRole('listitem');
        expect(rows.map((row) => row.textContent)).toEqual([
            expect.stringContaining('Weekly shop'),
            expect.stringContaining('Lunch'),
        ]);
        expect(within(rows[0]!).getByText('€45.99')).toBeDefined();
        expect(within(rows[0]!).getByText(en.categories.groceries)).toBeDefined();
    });

    it('does not show deleted expenses', async () => {
        stubApi(
            createFakeApi({ expenses: [expense({ text: 'Kept' }), expense({ text: 'Gone', deletedAt: 2_000 })] })
                .handler
        );

        renderApp();

        await screen.findByText('Kept');
        expect(screen.queryByText('Gone')).toBeNull();
    });

    it('says so when the expenses cannot be loaded', async () => {
        stubApi(() => new Response(null, { status: 500 }));

        renderApp();

        expect(await screen.findByText(en.expenses.list.loadFailed)).toBeDefined();
    });
});

describe('expense form', () => {
    it('starts on today', async () => {
        stubApi(createFakeApi().handler);

        renderApp();

        expect(((await screen.findByLabelText(en.expenses.form.date)) as HTMLInputElement).value).toBe(TODAY);
    });

    it('suggests a category while the description is typed', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByLabelText(en.expenses.form.text);

        fireEvent.change(field(en.expenses.form.text), { target: { value: 'Mercadona' } });

        expect(field(en.expenses.form.category).value).toBe('groceries');
        expect(screen.getByText(en.expenses.form.suggested)).toBeDefined();
    });

    it('stops suggesting once the user picks a category', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByLabelText(en.expenses.form.text);

        fireEvent.change(field(en.expenses.form.category), { target: { value: 'leisure' } });
        fireEvent.change(field(en.expenses.form.text), { target: { value: 'Mercadona' } });

        expect(field(en.expenses.form.category).value).toBe('leisure');
        expect(screen.queryByText(en.expenses.form.suggested)).toBeNull();
    });

    it('saves an expense and shows it in the list', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);

        fillAndSubmit({ amount: '12.50', text: 'Lunch' });

        expect(await screen.findByRole('listitem')).toBeDefined();
        await waitFor(() => expect(api.writes).toHaveLength(1));
        await waitFor(() => expect(screen.queryByText(en.expenses.list.pending)).toBeNull());
        expect(api.writes[0]).toMatchObject({
            categoryId: 'food',
            text: 'Lunch',
            amountCents: 1250,
            currency: 'EUR',
            date: TODAY,
            deletedAt: null,
        });
        expect(screen.getByRole('listitem').textContent).toContain('Lunch');
    });

    it('clears the amount and description after saving but keeps the date', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        fireEvent.change(field(en.expenses.form.date), { target: { value: '2026-10-20' } });

        fillAndSubmit({ amount: '3', text: 'Coffee' });

        await screen.findByRole('listitem');
        expect(field(en.expenses.form.amount).value).toBe('');
        expect(field(en.expenses.form.text).value).toBe('');
        expect(field(en.expenses.form.date).value).toBe('2026-10-20');
    });

    it('rejects an invalid amount without calling the API', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);

        fillAndSubmit({ amount: 'abc', text: 'Lunch' });

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.amountInvalid);
        expect(api.writes).toHaveLength(0);
    });
});

describe('deleting an expense', () => {
    it('marks it as deleted and removes it from the list', async () => {
        const lunch = expense({ text: 'Lunch' });
        const api = createFakeApi({ expenses: [lunch] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');

        fireEvent.click(screen.getByRole('button', { name: en.expenses.list.deleteItem.replace('{name}', 'Lunch') }));

        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());
        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ id: lunch.id, text: 'Lunch' });
        expect(api.writes[0]?.deletedAt).toBe(new Date(2026, 9, 25, 12).getTime());
        expect(api.writes[0]?.updatedAt).toBe(new Date(2026, 9, 25, 12).getTime());
    });
});

describe('working offline', () => {
    it('saves without waiting for the network, marks the expense, and syncs it when the connection is back', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        onlineManager.setOnline(false);

        fillAndSubmit({ amount: '12.50', text: 'Lunch' });

        const row = await screen.findByRole('listitem');
        expect(within(row).getByText(en.expenses.list.pending)).toBeDefined();
        expect(screen.getByText(en.sync.offline)).toBeDefined();
        expect(screen.getByText(t('sync.pending', { count: 1 }))).toBeDefined();
        expect(field(en.expenses.form.amount).value).toBe('');
        expect(api.attempts).toHaveLength(0);

        onlineManager.setOnline(true);

        await waitFor(() => expect(api.writes).toHaveLength(1));
        await waitFor(() => expect(screen.queryByText(en.expenses.list.pending)).toBeNull());
        expect(screen.queryByText(en.sync.offline)).toBeNull();
        expect(screen.queryByText(t('sync.pending', { count: 1 }))).toBeNull();
        expect(screen.getByRole('listitem').textContent).toContain('Lunch');
    });

    it('sends one write for an expense that was added and deleted before the connection came back', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        onlineManager.setOnline(false);
        fillAndSubmit({ amount: '3', text: 'Coffee' });
        await screen.findByRole('listitem');

        fireEvent.click(screen.getByRole('button', { name: en.expenses.list.deleteItem.replace('{name}', 'Coffee') }));
        await waitFor(() => expect(screen.queryByRole('listitem')).toBeNull());
        onlineManager.setOnline(true);

        await waitFor(() => expect(api.attempts).toHaveLength(1));
        expect(api.attempts[0]?.deletedAt).not.toBeNull();
    });

    it('keeps the expense on screen while the server is failing, and delivers it on the next sync', async () => {
        const api = createFakeApi();
        api.state.writeStatus = 503;
        stubApi(api.handler);
        const { queryClient } = renderApp();
        await screen.findByText(en.expenses.list.empty);

        fillAndSubmit({ amount: '12.50', text: 'Lunch' });

        const row = await screen.findByRole('listitem');
        await waitFor(() => expect(api.attempts).toHaveLength(1));
        expect(within(row).getByText(en.expenses.list.pending)).toBeDefined();

        api.state.writeStatus = null;
        await queryClient.invalidateQueries();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        await waitFor(() => expect(screen.queryByText(en.expenses.list.pending)).toBeNull());
    });

    it('shows what was saved in an earlier session before the server can be reached', async () => {
        const storage = createMemoryStorage();
        await storage.set('tarja:outbox', [expense({ text: 'From last session' })]);
        const outbox = createOutbox(storage);
        await outbox.ready;
        stubApi(createFakeApi().handler);
        onlineManager.setOnline(false);

        renderApp({ outbox });

        const row = await screen.findByRole('listitem');
        expect(row.textContent).toContain('From last session');
        expect(within(row).getByText(en.expenses.list.pending)).toBeDefined();
        expect(screen.queryByText(en.expenses.list.empty)).toBeNull();
    });

    it('tells the user when the server refuses an expense for good, until they dismiss it', async () => {
        const api = createFakeApi();
        api.state.writeStatus = 400;
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);

        fillAndSubmit({ amount: '12.50', text: 'Lunch' });

        expect((await screen.findByText(t('sync.rejected', { count: 1 }))).getAttribute('role')).toBe('alert');
        await waitFor(() => expect(screen.queryByRole('listitem')).toBeNull());

        fireEvent.click(screen.getByRole('button', { name: en.sync.dismiss }));

        expect(screen.queryByText(t('sync.rejected', { count: 1 }))).toBeNull();
    });

    it('says so when the expense cannot be stored on this device', async () => {
        const storage = { ...createMemoryStorage(), set: () => Promise.reject(new Error('quota exceeded')) };
        const outbox = createOutbox(storage);
        stubApi(createFakeApi().handler);
        renderApp({ outbox });
        await screen.findByText(en.expenses.list.empty);

        fillAndSubmit({ amount: '12.50', text: 'Lunch' });

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.saveFailed);
        expect(field(en.expenses.form.amount).value).toBe('12.50');
        expect(screen.queryByRole('listitem')).toBeNull();
    });
});
