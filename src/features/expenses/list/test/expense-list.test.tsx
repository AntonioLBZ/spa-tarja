import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createUserStorage } from '@/lib/offline';
import {
    deleteButton,
    deleteExpense,
    expense,
    field,
    fillAndSubmit,
    rowToggle,
    shown,
    t,
    TODAY,
} from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { TEST_USER } from '@/lib/testing/fake-auth';
import { createMemoryStorage } from '@/lib/testing/memory-storage';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { type Expense } from '@core/expenses/expense';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

describe('the list when the first pull fails', () => {
    const withASentExpense = async (pull: 'fails' | 'works') => {
        const storage = createMemoryStorage();
        await createUserStorage(storage, TEST_USER.id).storage.set('tarja:outbox', [expense({ text: 'Sent' })]);
        const api = createFakeApi({ expenses: [expense({ text: 'Older' })] });
        stubApi((url, init) => {
            if (pull === 'fails' && url.pathname === '/api/expenses' && (init?.method ?? 'GET') === 'GET')
                throw new TypeError('Failed to fetch');
            return api.handler(url, init);
        });
        return renderApp({ storage });
    };

    it('says the expenses could not be loaded when only the one that was sent is here', async () => {
        await withASentExpense('fails');

        expect(await screen.findByText(en.expenses.list.loadFailed)).toBeDefined();
        expect(screen.getByText('Sent')).toBeDefined();
        expect(screen.queryByText('Older')).toBeNull();
    });

    it('says nothing when the pull after the one that was sent works', async () => {
        await withASentExpense('works');

        expect(await screen.findByText('Older')).toBeDefined();
        expect(screen.getByText('Sent')).toBeDefined();
        expect(screen.queryByText(en.expenses.list.loadFailed)).toBeNull();
    });
});

describe('an expense row', () => {
    const lunch = expense({ text: 'Lunch' });
    const coffee = expense({ text: 'Coffee', amountCents: 300 });

    async function openList(...expenses: Expense[]) {
        stubApi(createFakeApi({ expenses }).handler);
        renderApp();
        await screen.findByText(expenses[0]!.text);
    }

    it('is closed to start with, with a toggle that says so and no Delete', async () => {
        await openList(lunch);

        expect(rowToggle('Lunch').getAttribute('aria-expanded')).toBe('false');
        expect(rowToggle('Lunch').hasAttribute('aria-controls')).toBe(false);
        expect(screen.queryByRole('button', { name: t('expenses.list.deleteItem', { name: 'Lunch' }) })).toBeNull();
    });

    it('is a toggle that holds the name, the amount and the details', async () => {
        const charged = expense({ text: 'Dinner', payment: 'credit', chargeDate: '2026-11-05' });
        await openList(lunch, charged);

        expect(rowToggle('Lunch').textContent).toContain('€12.50');
        expect(rowToggle('Lunch').textContent).toContain(en.categories.food);
        expect(rowToggle('Dinner').textContent).toContain(
            t('expenses.list.charged', { payment: en.expenses.payment.credit, date: shown('2026-11-05') })
        );
        expect(rowToggle('Lunch').getAttribute('type')).toBe('button');
    });

    it('is a row that is not a card, with its panel next to the toggle and not inside it', async () => {
        await openList(lunch);

        fireEvent.click(rowToggle('Lunch'));

        const row = screen.getByRole('listitem');
        expect(row.classList.contains('card')).toBe(false);
        expect(rowToggle('Lunch').parentElement).toBe(row);
        expect(rowToggle('Lunch').contains(deleteButton('Lunch'))).toBe(false);
        expect(deleteButton('Lunch').closest('li')).toBe(row);
    });

    it('opens a panel with Edit, Duplicate and Delete when pressed, and ties it to the toggle', async () => {
        await openList(lunch);

        fireEvent.click(rowToggle('Lunch'));

        const panel = deleteButton('Lunch').closest('.disclosure__panel')!;
        expect(rowToggle('Lunch').getAttribute('aria-expanded')).toBe('true');
        expect(rowToggle('Lunch').getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.id).not.toBe('');
        expect(rowToggle('Lunch').compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(within(panel as HTMLElement).getAllByRole('button')).toHaveLength(3);
    });

    it('closes the panel when pressed again', async () => {
        await openList(lunch);
        fireEvent.click(rowToggle('Lunch'));

        fireEvent.click(rowToggle('Lunch'));

        expect(rowToggle('Lunch').getAttribute('aria-expanded')).toBe('false');
        expect(rowToggle('Lunch').hasAttribute('aria-controls')).toBe(false);
        expect(screen.queryByRole('button', { name: t('expenses.list.deleteItem', { name: 'Lunch' }) })).toBeNull();
    });

    it('opens one by one: two rows can be open at once, each with its own Delete', async () => {
        await openList(lunch, coffee);

        fireEvent.click(rowToggle('Lunch'));
        fireEvent.click(rowToggle('Coffee'));

        expect(rowToggle('Lunch').getAttribute('aria-expanded')).toBe('true');
        expect(rowToggle('Coffee').getAttribute('aria-expanded')).toBe('true');
        expect(deleteButton('Lunch')).not.toBe(deleteButton('Coffee'));
        expect(rowToggle('Lunch').getAttribute('aria-controls')).not.toBe(
            rowToggle('Coffee').getAttribute('aria-controls')
        );

        fireEvent.click(rowToggle('Lunch'));

        expect(rowToggle('Lunch').getAttribute('aria-expanded')).toBe('false');
        expect(rowToggle('Coffee').getAttribute('aria-expanded')).toBe('true');
    });

    it('ends with a chevron that is decoration, and keeps its name to what it says', async () => {
        await openList(lunch);

        const chevron = rowToggle('Lunch').querySelector('[data-icon="expand_more"]')!;

        expect(chevron.getAttribute('aria-hidden')).toBe('true');
        expect(rowToggle('Lunch').lastElementChild!.contains(chevron)).toBe(true);
        expect(rowToggle('Lunch').hasAttribute('aria-label')).toBe(false);
        expect(screen.getByRole('button', { name: /^Lunch/ })).toBe(rowToggle('Lunch'));
    });

    it('has the chevron on every row, and still when it is open', async () => {
        await openList(lunch, coffee);

        fireEvent.click(rowToggle('Coffee'));

        expect(document.querySelectorAll('.expense-item [data-icon="expand_more"]')).toHaveLength(2);
    });

    it('stays open when another expense comes in', async () => {
        await openList(lunch);
        fireEvent.click(rowToggle('Lunch'));

        fillAndSubmit({ amount: '3', text: 'Tea' });

        await screen.findByText('Tea');
        expect(rowToggle('Lunch').getAttribute('aria-expanded')).toBe('true');
        expect(rowToggle('Tea').getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps the pending marker in the toggle, where it can be seen without opening the row', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        onlineManager.setOnline(false);

        fillAndSubmit({ amount: '3', text: 'Tea' });

        await screen.findByText('Tea');
        expect(within(rowToggle('Tea')).getByText(en.expenses.list.pending)).toBeDefined();
    });

    it('is one row for a plan, with one Delete in its panel', async () => {
        const plan = crypto.randomUUID();
        const parts = ['2026-10-25', '2026-11-25', '2026-12-25'].map((day, index) =>
            expense({ text: 'Sofa', chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        await openList(...parts);

        fireEvent.click(rowToggle('Sofa'));

        expect(screen.getAllByRole('listitem')).toHaveLength(1);
        expect(screen.getAllByRole('button', { name: t('expenses.list.deleteItem', { name: 'Sofa' }) })).toHaveLength(
            1
        );
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

        deleteExpense('Coffee');
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
        await createUserStorage(storage, TEST_USER.id).storage.set('tarja:outbox', [
            expense({ text: 'From last session' }),
        ]);
        stubApi(createFakeApi().handler);
        onlineManager.setOnline(false);

        renderApp({ storage });

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
        const memory = createMemoryStorage();
        const storage = {
            ...memory,
            set: (key: string, value: unknown) =>
                key.startsWith('tarja:outbox') ? Promise.reject(new Error('quota exceeded')) : memory.set(key, value),
        };
        stubApi(createFakeApi().handler);
        renderApp({ storage });
        await screen.findByText(en.expenses.list.empty);

        fillAndSubmit({ amount: '12.50', text: 'Lunch' });

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.saveFailed);
        expect(field(en.expenses.form.amount).value).toBe('12.50');
        expect(screen.queryByRole('listitem')).toBeNull();
    });
});
