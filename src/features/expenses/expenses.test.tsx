import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createUserStorage } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
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

function categoryLabels() {
    return [...(field(en.expenses.form.category) as HTMLSelectElement).options].map((option) => option.textContent);
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

describe('deferred expenses', () => {
    const paymentField = () => field(en.expenses.form.payment);
    const chargeField = () => field(en.expenses.form.chargeDate);
    const inputDate = (value: string) => fireEvent.change(field(en.expenses.form.date), { target: { value } });
    const shown = (isoDay: string) =>
        new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
            new Date(`${isoDay}T12:00:00`)
        );

    async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
        const api = createFakeApi(options);
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        return api;
    }

    it('are paid at once unless the person says so, with no charge date to fill in', async () => {
        await open();

        expect(paymentField().value).toBe('direct');
        expect(screen.queryByLabelText(en.expenses.form.chargeDate)).toBeNull();
        expect([...(paymentField() as HTMLSelectElement).options].map((option) => option.textContent)).toEqual([
            en.expenses.payment.direct,
            en.expenses.payment.credit,
            en.expenses.payment.voucher,
        ]);
    });

    it.each(['credit', 'voucher'])('ask when a %s expense is charged, proposing the next month', async (payment) => {
        await open();

        fireEvent.change(paymentField(), { target: { value: payment } });

        expect(chargeField().value).toBe('2026-11-25');
    });

    it('follow the day of the expense until the person picks another charge date', async () => {
        await open();
        fireEvent.change(paymentField(), { target: { value: 'credit' } });

        inputDate('2026-01-31');
        expect(chargeField().value).toBe('2026-02-28');

        fireEvent.change(chargeField(), { target: { value: '2026-03-05' } });
        inputDate('2026-01-30');
        expect(chargeField().value).toBe('2026-03-05');
    });

    it('are saved with how they were paid and when they are charged', async () => {
        const api = await open();
        fireEvent.change(paymentField(), { target: { value: 'credit' } });

        fillAndSubmit({ amount: '40', text: 'Shoes' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ date: TODAY, payment: 'credit', chargeDate: '2026-11-25' });
    });

    it('are saved on the charge date the person picked', async () => {
        const api = await open();
        fireEvent.change(paymentField(), { target: { value: 'voucher' } });
        fireEvent.change(chargeField(), { target: { value: '2026-12-01' } });

        fillAndSubmit({ amount: '9', text: 'Menu' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ payment: 'voucher', chargeDate: '2026-12-01' });
    });

    it('send no charge date once the person goes back to paying at once', async () => {
        const api = await open();
        fireEvent.change(paymentField(), { target: { value: 'credit' } });
        fireEvent.change(paymentField(), { target: { value: 'direct' } });

        fillAndSubmit({ amount: '5', text: 'Coffee' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ payment: 'direct', chargeDate: null });
        expect(screen.queryByLabelText(en.expenses.form.chargeDate)).toBeNull();
    });

    it('send a plain expense as paid at once', async () => {
        const api = await open();

        fillAndSubmit({ amount: '5', text: 'Coffee' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ payment: 'direct', chargeDate: null });
    });

    it('cannot be charged before the day they were made', async () => {
        const api = await open();
        fireEvent.change(paymentField(), { target: { value: 'credit' } });
        fireEvent.change(chargeField(), { target: { value: '2026-10-24' } });

        fillAndSubmit({ amount: '40', text: 'Shoes' });

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.chargeDateInvalid);
        expect(api.writes).toHaveLength(0);
        expect(field(en.expenses.form.amount).value).toBe('40');
    });

    it('go back to being paid at once after one is saved', async () => {
        await open();
        fireEvent.change(paymentField(), { target: { value: 'credit' } });
        fillAndSubmit({ amount: '40', text: 'Shoes' });
        await screen.findByRole('listitem');

        expect(paymentField().value).toBe('direct');
        expect(screen.queryByLabelText(en.expenses.form.chargeDate)).toBeNull();
    });

    it('show in the list how they were paid and when they are charged', async () => {
        stubApi(
            createFakeApi({
                expenses: [
                    expense({ text: 'Shoes', payment: 'credit', chargeDate: '2026-11-05' }),
                    expense({ text: 'Menu', payment: 'voucher', chargeDate: '2026-12-01' }),
                    expense({ text: 'Coffee' }),
                    expense({ text: 'Spread', payment: 'direct', chargeDate: '2026-11-05' }),
                ],
            }).handler
        );

        renderApp();

        const row = async (text: string) => (await screen.findByText(text)).closest('li')!;
        expect((await row('Shoes')).textContent).toContain(
            t('expenses.list.charged', { payment: en.expenses.payment.credit, date: shown('2026-11-05') })
        );
        expect((await row('Menu')).textContent).toContain(
            t('expenses.list.charged', { payment: en.expenses.payment.voucher, date: shown('2026-12-01') })
        );
        expect((await row('Coffee')).textContent).not.toContain(en.expenses.payment.credit);
        expect((await row('Coffee')).textContent).not.toContain('charged');
        expect((await row('Spread')).textContent).not.toContain('charged');
    });
});

describe('custom categories', () => {
    const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;

    it('are offered in the form after the built-in ones', async () => {
        stubApi(createFakeApi({ categories: [gym] }).handler);
        renderApp();

        await waitFor(() => expect(categoryLabels()).toContain('Gym'));
        expect(categoryLabels()).toEqual([...Object.values(en.categories), 'Gym']);
    });

    it('can be picked for an expense, which is saved with the category id', async () => {
        const api = createFakeApi({ categories: [gym] });
        stubApi(api.handler);
        renderApp();
        await waitFor(() => expect(categoryLabels()).toContain('Gym'));

        fireEvent.change(field(en.expenses.form.category), { target: { value: gym.id } });
        fillAndSubmit({ amount: '30', text: 'Monthly fee' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.categoryId).toBe(gym.id);
    });

    it('go back to the suggestion when the picked one is gone', async () => {
        const api = createFakeApi({ categories: [gym] });
        stubApi(api.handler);
        const { queryClient } = renderApp();
        await waitFor(() => expect(categoryLabels()).toContain('Gym'));
        fireEvent.change(field(en.expenses.form.category), { target: { value: gym.id } });

        queryClient.setQueryData(['categories'], []);

        await waitFor(() => expect(field(en.expenses.form.category).value).toBe('other'));
    });

    it('name the expenses filed under them in the list', async () => {
        stubApi(
            createFakeApi({ categories: [gym], expenses: [expense({ text: 'Monthly fee', categoryId: gym.id })] })
                .handler
        );

        renderApp();

        const row = (await screen.findByText('Monthly fee')).closest('li')!;
        await waitFor(() => expect(within(row).queryByText('Gym')).not.toBeNull());
    });

    it('show as Other once the category is gone', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: 'Monthly fee', categoryId: gym.id })] }).handler);

        renderApp();

        const row = (await screen.findByText('Monthly fee')).closest('li')!;
        expect(within(row).getByText(en.categories.other)).toBeDefined();
    });
});

function lookOf(element: HTMLElement) {
    const icon = element.querySelector('[data-icon]')?.getAttribute('data-icon') ?? null;
    const color = /category-badge--(\w+)/.exec(element.querySelector('.category-badge')?.className ?? '')?.[1] ?? null;
    return { icon, color };
}

describe('category looks', () => {
    const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;

    it('mark each row with the icon and color of its category, built-in or not', async () => {
        stubApi(
            createFakeApi({
                categories: [gym],
                expenses: [
                    expense({ text: 'Lunch', categoryId: 'food' }),
                    expense({ text: 'Monthly fee', categoryId: gym.id }),
                    expense({ text: 'Long gone', categoryId: crypto.randomUUID() }),
                ],
            }).handler
        );

        renderApp();

        const row = async (text: string) => (await screen.findByText(text)).closest('li')!;
        expect(lookOf(await row('Lunch'))).toEqual({ icon: 'restaurant', color: 'vermillion' });
        await waitFor(() => expect(lookOf(screen.getByText('Monthly fee').closest('li')!).icon).toBe('fitness_center'));
        expect(lookOf(await row('Monthly fee'))).toEqual({ icon: 'fitness_center', color: 'blue' });
        expect(lookOf(await row('Long gone'))).toEqual({ icon: 'more_horiz', color: 'gray' });
    });

    it('show next to the category picker, following the pick and the suggestion', async () => {
        stubApi(createFakeApi({ categories: [gym] }).handler);
        renderApp();
        await waitFor(() => expect(categoryLabels()).toContain('Gym'));
        const picker = () => field(en.expenses.form.category).closest('.expense-form__field') as HTMLElement;
        expect(lookOf(picker())).toEqual({ icon: 'more_horiz', color: 'gray' });

        fireEvent.change(field(en.expenses.form.text), { target: { value: 'coffee' } });
        expect(lookOf(picker())).toEqual({ icon: 'restaurant', color: 'vermillion' });

        fireEvent.change(field(en.expenses.form.category), { target: { value: gym.id } });
        expect(lookOf(picker())).toEqual({ icon: 'fitness_center', color: 'blue' });
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

describe('a deleted expense leaving the list', () => {
    const root = document.documentElement;
    const lunch = expense({ text: 'Lunch' });
    const deleteLunch = () =>
        fireEvent.click(screen.getByRole('button', { name: en.expenses.list.deleteItem.replace('{name}', 'Lunch') }));

    afterEach(() => root.style.removeProperty('--duration-base'));

    it('stays on screen, marked, while it fades out, and goes once the fade is over', async () => {
        root.style.setProperty('--duration-base', '60ms');
        const api = createFakeApi({ expenses: [lunch, expense({ text: 'Dinner' })] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteLunch();

        const row = screen.getByText('Lunch').closest('li')!;
        expect(row.className).toContain('expense-item--leaving');
        expect(screen.getByText('Dinner').closest('li')!.className).not.toContain('expense-item--leaving');
        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());
        expect(screen.getByText('Dinner')).toBeDefined();
    });

    it('is saved as deleted at once, not after the fade', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        const api = createFakeApi({ expenses: [lunch] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteLunch();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.deletedAt).not.toBeNull();
        expect(screen.getByText('Lunch')).toBeDefined();
    });

    it('cannot be deleted a second time while it fades', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteLunch();

        const button = screen.getByRole('button', {
            name: en.expenses.list.deleteItem.replace('{name}', 'Lunch'),
        }) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
    });

    it('goes at once when there is no motion', async () => {
        root.style.setProperty('--duration-base', '0ms');
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp();
        await screen.findByText('Lunch');

        const row = screen.getByText('Lunch').closest('li')!;
        deleteLunch();

        expect(row.className).not.toContain('expense-item--leaving');
        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());
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
