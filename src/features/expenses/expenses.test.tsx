import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { CATEGORIES_KEY } from '@/lib/api';
import { createUserStorage } from '@/lib/offline';
import { categoryNames, chosenCategory, pickCategory } from '@/lib/test/category-select';
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

function shown(isoDay: string) {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(`${isoDay}T12:00:00`)
    );
}

function field(label: string) {
    return screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement;
}

// Polling must not touch the page, which is what reading the options of the select does
function categoriesLoaded(app: {
    queryClient: { getQueryState: (key: readonly string[]) => { status: string } | undefined };
}) {
    return waitFor(() => expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success'));
}

function categoryLabels() {
    return categoryNames(en.expenses.form.category);
}

function fillAndSubmit({ amount, text }: { amount: string; text: string }) {
    fireEvent.change(field(en.expenses.form.amount), { target: { value: amount } });
    fireEvent.change(field(en.expenses.form.text), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));
}

function rowToggle(name: string) {
    return screen.getByText(name).closest('button')!;
}

function deleteButton(name: string) {
    return screen.getByRole('button', { name: t('expenses.list.deleteItem', { name }) }) as HTMLButtonElement;
}

function deleteExpense(name: string) {
    fireEvent.click(rowToggle(name));
    fireEvent.click(deleteButton(name));
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

        expect(chosenCategory(en.expenses.form.category)).toBe(en.categories.groceries);
        expect(screen.getByText(en.expenses.form.suggested)).toBeDefined();
    });

    it('stops suggesting once the user picks a category', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByLabelText(en.expenses.form.text);

        pickCategory(en.expenses.form.category, en.categories.leisure);
        fireEvent.change(field(en.expenses.form.text), { target: { value: 'Mercadona' } });

        expect(chosenCategory(en.expenses.form.category)).toBe(en.categories.leisure);
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

    it('puts the message about the amount under the amount, which it describes', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);

        fillAndSubmit({ amount: 'abc', text: 'Lunch' });

        const alert = await screen.findByRole('alert');
        const amount = field(en.expenses.form.amount);
        expect(alert.parentElement).toBe(amount.closest('.field'));
        expect(amount.getAttribute('aria-describedby')).toBe(alert.id);
        expect(amount.getAttribute('aria-invalid')).toBe('true');
        expect(field(en.expenses.form.text).hasAttribute('aria-describedby')).toBe(false);
    });
});

describe('the add form', () => {
    function formToggle() {
        return screen.getByRole('button', { name: en.expenses.form.title });
    }

    function submitShown() {
        return screen.queryByRole('button', { name: en.expenses.form.submit }) !== null;
    }

    it('is open to start with, under a heading that is its toggle', async () => {
        stubApi(createFakeApi().handler);
        renderApp();

        const heading = await screen.findByRole('heading', { level: 2, name: en.expenses.form.title });

        expect(heading.firstElementChild).toBe(formToggle());
        expect(formToggle().getAttribute('aria-expanded')).toBe('true');
        expect(formToggle().getAttribute('aria-controls')).toBe(
            field(en.expenses.form.amount).closest('.disclosure__panel')!.id
        );
        expect(screen.getByRole('form', { name: en.expenses.form.title })).toBeDefined();
        expect(screen.getAllByRole('heading', { name: en.expenses.form.title })).toHaveLength(1);
        expect(submitShown()).toBe(true);
    });

    it('collapses and opens again from its heading, keeping the focus on it', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByRole('heading', { name: en.expenses.form.title });
        const toggle = formToggle();
        toggle.focus();

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.hasAttribute('aria-controls')).toBe(false);
        expect(submitShown()).toBe(false);
        expect(document.activeElement).toBe(toggle);

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(submitShown()).toBe(true);
        expect(document.activeElement).toBe(toggle);
    });

    it('keeps what was typed while it is collapsed', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByRole('heading', { name: en.expenses.form.title });
        fireEvent.change(field(en.expenses.form.amount), { target: { value: '12.50' } });
        fireEvent.change(field(en.expenses.form.text), { target: { value: 'Lunch' } });

        fireEvent.click(formToggle());
        fireEvent.click(formToggle());

        expect(field(en.expenses.form.amount).value).toBe('12.50');
        expect(field(en.expenses.form.text).value).toBe('Lunch');
    });
});

describe('deferred expenses', () => {
    const paymentField = () => field(en.expenses.form.payment);
    const chargeField = () => field(en.expenses.form.chargeDate);
    const inputDate = (value: string) => fireEvent.change(field(en.expenses.form.date), { target: { value } });
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

    it('puts the message about the charge date under the charge date', async () => {
        await open();
        fireEvent.change(paymentField(), { target: { value: 'credit' } });
        fireEvent.change(chargeField(), { target: { value: '2026-10-24' } });

        fillAndSubmit({ amount: '40', text: 'Shoes' });

        const alert = await screen.findByRole('alert');
        expect(alert.parentElement).toBe(chargeField().closest('.field'));
        expect(chargeField().getAttribute('aria-describedby')).toBe(alert.id);
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

describe('your part of a restaurant card expense', () => {
    const paymentField = () => field(en.expenses.form.payment);
    const personalField = () => field(en.expenses.form.personal) as HTMLInputElement;
    const pay = (payment: string) => fireEvent.change(paymentField(), { target: { value: payment } });
    const typeAmount = (value: string) => fireEvent.change(field(en.expenses.form.amount), { target: { value } });
    const typePart = (value: string) => fireEvent.change(personalField(), { target: { value } });
    const submit = () => fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));
    async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
        const api = createFakeApi(options);
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        return api;
    }

    it('is asked only for a restaurant card, empty to begin with', async () => {
        await open();
        expect(screen.queryByLabelText(en.expenses.form.personal)).toBeNull();

        pay('credit');
        expect(screen.queryByLabelText(en.expenses.form.personal)).toBeNull();

        pay('voucher');
        expect(personalField().value).toBe('');
        expect(field(en.expenses.form.amount)).toBeDefined();
        expect(screen.queryByLabelText(en.expenses.form.installments)).toBeNull();
    });

    it('is saved with what the card paid', async () => {
        const api = await open();
        pay('voucher');
        typePart('20');

        fillAndSubmit({ amount: '40', text: 'Dinner' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ amountCents: 4000, personalCents: 2000, payment: 'voucher' });
    });

    it('is the whole amount when left empty', async () => {
        const api = await open();
        pay('voucher');

        fillAndSubmit({ amount: '9', text: 'Menu' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ amountCents: 900, personalCents: null, payment: 'voucher' });
    });

    it('can be nothing, when the others pay all of it back', async () => {
        const api = await open();
        pay('voucher');
        typePart('0');

        fillAndSubmit({ amount: '40', text: 'Their dinner' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ amountCents: 4000, personalCents: 0 });
    });

    it('says what the others pay back, under the field it describes', async () => {
        await open();
        pay('voucher');
        typeAmount('40');

        typePart('15');

        const hint = screen.getByText(t('expenses.form.paidBack', { amount: '€25.00' }));
        expect(hint.parentElement).toBe(personalField().closest('.field'));
        expect(personalField().getAttribute('aria-describedby')).toBe(hint.id);
    });

    it('says nothing about paying back when the part is all of it, or empty', async () => {
        await open();
        pay('voucher');
        typeAmount('40');

        typePart('40');
        expect(screen.queryByText(/pay back/)).toBeNull();

        typePart('');
        expect(screen.queryByText(/pay back/)).toBeNull();
    });

    it('refuses a part over the total, with the message under the field', async () => {
        const api = await open();
        pay('voucher');
        typeAmount('40');

        typePart('50');

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toBe(en.expenses.form.personalOver);
        expect(alert.parentElement).toBe(personalField().closest('.field'));
        expect(personalField().getAttribute('aria-invalid')).toBe('true');
        expect(personalField().getAttribute('aria-describedby')).toBe(alert.id);
        submit();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.writes).toHaveLength(0);
        expect(field(en.expenses.form.amount).value).toBe('40');
    });

    it('stops complaining once the part fits in the total', async () => {
        await open();
        pay('voucher');
        typeAmount('40');
        typePart('50');
        await screen.findByRole('alert');

        typeAmount('60');

        expect(screen.queryByRole('alert')).toBeNull();
        expect(personalField().getAttribute('aria-invalid')).toBe('false');
    });

    it('refuses a part that is not an amount', async () => {
        const api = await open();
        pay('voucher');
        typePart('abc');

        fillAndSubmit({ amount: '40', text: 'Dinner' });

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.personalInvalid);
        expect(personalField().getAttribute('aria-invalid')).toBe('true');
        expect(api.writes).toHaveLength(0);

        typePart('20');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('is cleared when the payment changes away from the restaurant card', async () => {
        const api = await open();
        pay('voucher');
        typePart('20');

        pay('credit');
        expect(screen.queryByLabelText(en.expenses.form.personal)).toBeNull();
        pay('voucher');
        expect(personalField().value).toBe('');
        pay('credit');
        fillAndSubmit({ amount: '40', text: 'Shoes' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ payment: 'credit', personalCents: null });
    });

    it('is empty again for the next expense once one is saved', async () => {
        await open();
        pay('voucher');
        typePart('20');
        fillAndSubmit({ amount: '40', text: 'Dinner' });
        await screen.findByRole('listitem');

        pay('voucher');

        expect(personalField().value).toBe('');
    });

    it('is what the list shows, with what the card paid when the two differ', async () => {
        stubApi(
            createFakeApi({
                expenses: [
                    expense({
                        text: 'Dinner',
                        amountCents: 4000,
                        personalCents: 2000,
                        payment: 'voucher',
                        chargeDate: '2026-11-12',
                    }),
                    expense({ text: 'Menu', amountCents: 900, payment: 'voucher', chargeDate: '2026-11-24' }),
                    expense({
                        text: 'All mine',
                        amountCents: 1500,
                        personalCents: 1500,
                        payment: 'voucher',
                        chargeDate: '2026-11-24',
                    }),
                ],
            }).handler
        );

        renderApp();

        const row = async (text: string) => (await screen.findByText(text)).closest('li')!;
        const dinner = await row('Dinner');
        expect(dinner.querySelector('.expense-item__amount')!.textContent).toBe('€20.00');
        expect(dinner.textContent).toContain(t('expenses.list.paid', { total: '€40.00' }));
        expect((await row('Menu')).querySelector('.expense-item__amount')!.textContent).toBe('€9.00');
        expect((await row('Menu')).textContent).not.toContain('Paid');
        expect((await row('All mine')).querySelector('.expense-item__amount')!.textContent).toBe('€15.00');
        expect((await row('All mine')).textContent).not.toContain('Paid');
    });
});

describe('installments', () => {
    const installments = () => field(en.expenses.form.installments) as HTMLSelectElement;
    const partLabel = (part: number, parts: number, day: string) =>
        t('expenses.form.part', { part, parts, date: shown(day) });
    const partField = (part: number, parts: number, day: string) => field(partLabel(part, parts, day));
    const DAYS = ['2026-10-25', '2026-11-25', '2026-12-25'];
    const submit = () => screen.getByRole('button', { name: en.expenses.form.submit }) as HTMLButtonElement;
    const typeAmount = (value: string) => fireEvent.change(field(en.expenses.form.amount), { target: { value } });
    const typeText = (value: string) => fireEvent.change(field(en.expenses.form.text), { target: { value } });

    async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
        const api = createFakeApi(options);
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        return api;
    }

    it('are one payment unless the person asks for more, with no parts to fill in', async () => {
        await open();

        expect(installments().value).toBe('1');
        expect([...installments().options].map((option) => option.textContent)).toEqual([
            t('expenses.form.installmentsOption', { count: 1 }),
            ...Array.from({ length: 11 }, (_, index) => t('expenses.form.installmentsOption', { count: index + 2 })),
        ]);
        expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('are only for what is paid at once: a credit or restaurant card has its own charge date', async () => {
        await open();
        fireEvent.change(field(en.expenses.form.payment), { target: { value: 'credit' } });

        expect(screen.queryByLabelText(en.expenses.form.installments)).toBeNull();
    });

    it('split the amount evenly, a part for each month, the remainder going to the first ones', async () => {
        await open();
        typeAmount('15.01');

        fireEvent.change(installments(), { target: { value: '3' } });

        expect(partField(1, 3, DAYS[0]!).value).toBe('5.01');
        expect(partField(2, 3, DAYS[1]!).value).toBe('5.00');
        expect(partField(3, 3, DAYS[2]!).value).toBe('5.00');
        expect(screen.queryByText(/Remaining/)).toBeNull();
    });

    it('split again when the total changes', async () => {
        await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '9' } });

        typeAmount('30');

        expect(partField(1, 3, DAYS[0]!).value).toBe('10.00');
    });

    it('split again when the number of payments changes', async () => {
        await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '9' } });

        fireEvent.change(installments(), { target: { value: '2' } });

        expect(partField(1, 2, DAYS[0]!).value).toBe('7.50');
        expect(partField(2, 2, DAYS[1]!).value).toBe('7.50');
    });

    it('keep what was typed when the total is only written another way', async () => {
        await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '9' } });

        typeAmount('15.00');

        expect(partField(1, 3, DAYS[0]!).value).toBe('9');
    });

    it('follow the day of the purchase', async () => {
        await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '2' } });

        fireEvent.change(field(en.expenses.form.date), { target: { value: '2026-01-31' } });

        expect(partField(1, 2, '2026-01-31').value).toBe('7.50');
        expect(partField(2, 2, '2026-02-28').value).toBe('7.50');
    });

    it('say what is left to assign, and do not save until the parts add up', async () => {
        const api = await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });

        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '4' } });

        expect(screen.getByText(t('expenses.form.remaining', { amount: '€1.00' }))).toBeDefined();
        expect(submit().disabled).toBe(true);
        fireEvent.submit(submit().closest('form')!);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.writes).toHaveLength(0);
        expect(screen.getByText(t('expenses.form.remaining', { amount: '€1.00' }))).toBeDefined();
    });

    it('refuse parts that go over the total', async () => {
        const api = await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });

        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '6' } });

        expect((await screen.findByRole('alert')).textContent).toBe(t('expenses.form.over', { amount: '€1.00' }));
        expect(submit().disabled).toBe(true);
        expect(api.writes).toHaveLength(0);
    });

    it('refuse a part that is not an amount above zero', async () => {
        const api = await open();
        typeAmount('10');
        fireEvent.change(installments(), { target: { value: '2' } });

        fireEvent.change(partField(1, 2, DAYS[0]!), { target: { value: '10' } });
        fireEvent.change(partField(2, 2, DAYS[1]!), { target: { value: '0' } });

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.partInvalid);
        expect(partField(2, 2, DAYS[1]!).getAttribute('aria-invalid')).toBe('true');
        expect(submit().disabled).toBe(true);
        expect(api.writes).toHaveLength(0);
    });

    it('add up again once the parts are fixed', async () => {
        await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });
        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '4' } });
        expect(submit().disabled).toBe(true);

        fireEvent.change(partField(2, 3, DAYS[1]!), { target: { value: '6' } });

        expect(submit().disabled).toBe(false);
        expect(screen.queryByText(/Remaining/)).toBeNull();
    });

    it('are saved as one expense for each part, linked as a plan, each counting in its own month', async () => {
        const api = await open();
        typeAmount('15.01');
        typeText('Sofa');
        fireEvent.change(installments(), { target: { value: '3' } });

        fireEvent.click(submit());

        await waitFor(() => expect(api.writes).toHaveLength(3));
        const planIds = new Set(api.writes.map((write) => write.plan?.id));
        expect(planIds.size).toBe(1);
        expect(new Set(api.writes.map((write) => write.id)).size).toBe(3);
        expect(
            api.writes.map((write) => [write.plan?.part, write.plan?.parts, write.amountCents, write.chargeDate])
        ).toEqual([
            [1, 3, 501, DAYS[0]],
            [2, 3, 500, DAYS[1]],
            [3, 3, 500, DAYS[2]],
        ]);
        const now = Date.now();
        for (const write of api.writes) {
            expect(write).toMatchObject({
                text: 'Sofa',
                categoryId: 'other',
                date: TODAY,
                payment: 'direct',
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
            });
        }
    });

    it('are saved with the amounts the person set', async () => {
        const api = await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '5' } });
        fireEvent.change(partField(2, 3, DAYS[1]!), { target: { value: '6' } });
        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '4' } });

        fireEvent.click(submit());

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(api.writes.map((write) => write.amountCents)).toEqual([500, 600, 400]);
    });

    it('are left out when the expense is deferred after all', async () => {
        const api = await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });

        fireEvent.change(field(en.expenses.form.payment), { target: { value: 'credit' } });
        fireEvent.click(submit());

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({
            amountCents: 1500,
            payment: 'credit',
            chargeDate: '2026-11-25',
            plan: null,
        });
    });

    it('come back when the expense is paid at once again', async () => {
        await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });
        fireEvent.change(field(en.expenses.form.payment), { target: { value: 'credit' } });

        fireEvent.change(field(en.expenses.form.payment), { target: { value: 'direct' } });

        expect(installments().value).toBe('3');
        expect(partField(3, 3, DAYS[2]!).value).toBe('5.00');
    });

    it('start from an even split again for the next expense, whatever was typed in the last one', async () => {
        const api = await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '6' } });
        fireEvent.change(partField(2, 3, DAYS[1]!), { target: { value: '5' } });
        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '4' } });
        fireEvent.click(submit());
        await waitFor(() => expect(api.writes).toHaveLength(3));

        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });

        expect(partField(1, 3, DAYS[0]!).value).toBe('5.00');
        expect(partField(3, 3, DAYS[2]!).value).toBe('5.00');
    });

    it('go back to one payment after a plan is saved', async () => {
        await open();
        typeAmount('15');
        fireEvent.change(installments(), { target: { value: '3' } });

        fireEvent.click(submit());
        await screen.findByRole('listitem');

        expect(installments().value).toBe('1');
        expect(field(en.expenses.form.amount).value).toBe('');
    });

    it('show in the list as one expense with the total and where the plan ends', async () => {
        const plan = crypto.randomUUID();
        const parts = DAYS.map((day, index) =>
            expense({
                text: 'Sofa',
                amountCents: 500 + index,
                payment: 'direct',
                chargeDate: day,
                plan: { id: plan, part: index + 1, parts: 3 },
            })
        );
        stubApi(createFakeApi({ expenses: [...parts.toReversed(), expense({ text: 'Coffee' })] }).handler);

        renderApp();

        const row = (await screen.findByText('Sofa')).closest('li')!;
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(row.textContent).toContain('€15.03');
        expect(row.textContent).toContain(t('expenses.list.plan', { parts: 3, date: shown(DAYS[2]!) }));
    });

    it('are marked as not synced when only one of the parts is waiting', async () => {
        const plan = crypto.randomUUID();
        const parts = DAYS.map((day, index) =>
            expense({ text: 'Sofa', chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        const api = createFakeApi({ expenses: parts });
        stubApi(api.handler);
        const { outbox } = renderApp();
        await screen.findByText(t('expenses.list.plan', { parts: 3, date: shown(DAYS[2]!) }));
        const row = screen.getByText('Sofa').closest('li')!;
        expect(within(row).queryByText(en.expenses.list.pending)).toBeNull();
        api.state.writeStatus = 503;

        await outbox.put({ ...parts[1]!, updatedAt: 2_000 });

        expect(await within(row).findByText(en.expenses.list.pending)).toBeDefined();
    });

    it('are deleted together from the list', async () => {
        const plan = crypto.randomUUID();
        const parts = DAYS.map((day, index) =>
            expense({ text: 'Sofa', chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        const api = createFakeApi({ expenses: parts });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Sofa');

        deleteExpense('Sofa');

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(api.writes.every((write) => write.deletedAt !== null)).toBe(true);
        await waitFor(() => expect(screen.queryByText('Sofa')).toBeNull());
    });

    it('wait as one expense, with every part, until the connection is back', async () => {
        const api = await open();
        onlineManager.setOnline(false);
        typeAmount('15');
        typeText('Sofa');
        fireEvent.change(installments(), { target: { value: '3' } });

        fireEvent.click(submit());

        const row = await screen.findByRole('listitem');
        expect(within(row).getAllByText(en.expenses.list.pending)).toHaveLength(1);
        expect(screen.getByText(t('sync.pending', { count: 3 }))).toBeDefined();
        expect(api.attempts).toHaveLength(0);

        onlineManager.setOnline(true);

        await waitFor(() => expect(api.writes).toHaveLength(3));
        await waitFor(() => expect(screen.queryByText(en.expenses.list.pending)).toBeNull());
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
});

describe('custom categories', () => {
    const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;

    it('are offered in the form after the built-in ones', async () => {
        stubApi(createFakeApi({ categories: [gym] }).handler);
        const app = renderApp();

        await categoriesLoaded(app);
        expect(categoryLabels()).toEqual([...Object.values(en.categories), 'Gym']);
    });

    it('can be picked for an expense, which is saved with the category id', async () => {
        const api = createFakeApi({ categories: [gym] });
        stubApi(api.handler);
        const app = renderApp();
        await categoriesLoaded(app);

        pickCategory(en.expenses.form.category, 'Gym');
        fillAndSubmit({ amount: '30', text: 'Monthly fee' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.categoryId).toBe(gym.id);
    });

    it('go back to the suggestion when the picked one is gone', async () => {
        const api = createFakeApi({ categories: [gym] });
        stubApi(api.handler);
        const app = renderApp();
        await categoriesLoaded(app);
        pickCategory(en.expenses.form.category, 'Gym');

        app.queryClient.setQueryData(['categories'], []);

        await waitFor(() => expect(chosenCategory(en.expenses.form.category)).toBe(en.categories.other));
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
        const app = renderApp();
        await categoriesLoaded(app);
        const picker = () =>
            screen.getByRole('combobox', { name: en.expenses.form.category }).closest('.field') as HTMLElement;
        expect(lookOf(picker())).toEqual({ icon: 'more_horiz', color: 'gray' });

        fireEvent.change(field(en.expenses.form.text), { target: { value: 'coffee' } });
        expect(lookOf(picker())).toEqual({ icon: 'restaurant', color: 'vermillion' });

        pickCategory(en.expenses.form.category, 'Gym');
        expect(lookOf(picker())).toEqual({ icon: 'fitness_center', color: 'blue' });
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

    it('is the toggle that gets the notch, with the panel next to it and not inside', async () => {
        await openList(lunch);

        fireEvent.click(rowToggle('Lunch'));

        const row = screen.getByRole('listitem');
        expect(row.classList.contains('card')).toBe(false);
        expect(rowToggle('Lunch').parentElement).toBe(row);
        expect(rowToggle('Lunch').contains(deleteButton('Lunch'))).toBe(false);
        expect(deleteButton('Lunch').closest('li')).toBe(row);
    });

    it('opens a panel with Delete when pressed, and ties it to the toggle', async () => {
        await openList(lunch);

        fireEvent.click(rowToggle('Lunch'));

        const panel = deleteButton('Lunch').closest('.disclosure__panel')!;
        expect(rowToggle('Lunch').getAttribute('aria-expanded')).toBe('true');
        expect(rowToggle('Lunch').getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.id).not.toBe('');
        expect(rowToggle('Lunch').compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(within(panel as HTMLElement).getAllByRole('button')).toHaveLength(1);
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

describe('deleting an expense', () => {
    it('marks it as deleted and removes it from the list', async () => {
        const lunch = expense({ text: 'Lunch' });
        const api = createFakeApi({ expenses: [lunch] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteExpense('Lunch');

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
    const deleteLunch = () => deleteExpense('Lunch');

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

        expect(deleteButton('Lunch').disabled).toBe(true);
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

describe('a deleted plan leaving the list', () => {
    const root = document.documentElement;
    afterEach(() => root.style.removeProperty('--duration-base'));

    it('keeps its total and every payment on screen while it fades out', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        const plan = crypto.randomUUID();
        const parts = ['2026-10-25', '2026-11-25', '2026-12-25'].map((day, index) =>
            expense({ text: 'Sofa', amountCents: 500, chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        const api = createFakeApi({ expenses: parts });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Sofa');

        deleteExpense('Sofa');

        await waitFor(() => expect(api.writes).toHaveLength(3));
        const row = screen.getByText('Sofa').closest('li')!;
        expect(row.className).toContain('expense-item--leaving');
        expect(row.textContent).toContain('€15.00');
        expect(row.textContent).toContain(t('expenses.list.plan', { parts: 3, date: shown('2026-12-25') }));
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('goes entirely once the fade is over', async () => {
        root.style.setProperty('--duration-base', '60ms');
        const plan = crypto.randomUUID();
        const parts = ['2026-10-25', '2026-11-25', '2026-12-25'].map((day, index) =>
            expense({ text: 'Sofa', chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        stubApi(createFakeApi({ expenses: parts }).handler);
        renderApp();
        await screen.findByText('Sofa');

        deleteExpense('Sofa');

        await waitFor(() => expect(screen.queryByText('Sofa')).toBeNull());
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
