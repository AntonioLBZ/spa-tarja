import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { CATEGORIES_KEY } from '@/lib/api';
import { createUserStorage } from '@/lib/offline';
import { categoryNames, chosenCategory, pickCategory } from '@/lib/test/category-select';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { addMonths } from '@core/date';
import { expenseInputSchema, type Expense } from '@core/expense';

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
        const panel = field(en.expenses.form.amount).closest('.disclosure__panel')!;
        toggle.focus();

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.getAttribute('aria-controls')).toBe(panel.id);
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

    it('is a row that is not a card, with its panel next to the toggle and not inside it', async () => {
        await openList(lunch);

        fireEvent.click(rowToggle('Lunch'));

        const row = screen.getByRole('listitem');
        expect(row.classList.contains('card')).toBe(false);
        expect(rowToggle('Lunch').parentElement).toBe(row);
        expect(rowToggle('Lunch').contains(deleteButton('Lunch'))).toBe(false);
        expect(deleteButton('Lunch').closest('li')).toBe(row);
    });

    it('opens a panel with Edit and Delete when pressed, and ties it to the toggle', async () => {
        await openList(lunch);

        fireEvent.click(rowToggle('Lunch'));

        const panel = deleteButton('Lunch').closest('.disclosure__panel')!;
        expect(rowToggle('Lunch').getAttribute('aria-expanded')).toBe('true');
        expect(rowToggle('Lunch').getAttribute('aria-controls')).toBe(panel.id);
        expect(panel.id).not.toBe('');
        expect(rowToggle('Lunch').compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(within(panel as HTMLElement).getAllByRole('button')).toHaveLength(2);
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

describe('the focus after a delete', () => {
    const root = document.documentElement;
    const first = expense({ text: 'First', date: '2026-10-25' });
    const second = expense({ text: 'Second', date: '2026-10-24' });
    const third = expense({ text: 'Third', date: '2026-10-23' });

    afterEach(() => root.style.removeProperty('--duration-base'));

    async function openList(...expenses: Expense[]) {
        stubApi(createFakeApi({ expenses }).handler);
        renderApp();
        await screen.findByText(expenses[0]!.text);
    }

    function listTitle() {
        return screen.getByRole('heading', { name: en.expenses.list.title });
    }

    it('goes to the next row, which is the one that takes the place of the deleted one', async () => {
        await openList(first, second, third);

        deleteExpense('Second');

        expect(document.activeElement).toBe(rowToggle('Third'));
    });

    it('goes to the row before when the deleted one was the last', async () => {
        await openList(first, second, third);

        deleteExpense('Third');

        expect(document.activeElement).toBe(rowToggle('Second'));
    });

    it('goes to the next row of the same day, and past the end of a day to the next one', async () => {
        const later = expense({ text: 'Later', date: '2026-10-25', createdAt: 5_000 });
        await openList(first, later, second);

        deleteExpense('Later');
        expect(document.activeElement).toBe(rowToggle('First'));

        deleteExpense('First');
        expect(document.activeElement).toBe(rowToggle('Second'));
    });

    it('goes to the list title when no row is left', async () => {
        await openList(first);

        deleteExpense('First');

        expect(document.activeElement).toBe(listTitle());
    });

    it('moves at once, while the deleted row is still fading out', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        await openList(first, second);

        deleteExpense('First');

        expect(screen.getByText('First')).toBeDefined();
        expect(document.activeElement).toBe(rowToggle('Second'));
    });

    it('skips a row that is already fading out', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        await openList(first, second, third);
        deleteExpense('Second');

        deleteExpense('Third');

        expect(document.activeElement).toBe(rowToggle('First'));
    });

    it('goes to the title when the only rows left are fading out', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        await openList(first, second);
        deleteExpense('First');

        deleteExpense('Second');

        expect(document.activeElement).toBe(listTitle());
    });

    it('goes to the next row when a whole plan is deleted', async () => {
        const plan = crypto.randomUUID();
        const parts = ['2026-10-24', '2026-11-24'].map((day, index) =>
            expense({
                text: 'Sofa',
                date: '2026-10-24',
                chargeDate: day,
                plan: { id: plan, part: index + 1, parts: 2 },
            })
        );
        await openList(first, ...parts, third);

        deleteExpense('Sofa');

        expect(document.activeElement).toBe(rowToggle('Third'));
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

describe('editing an expense', () => {
    const lunch = expense({ text: 'Lunch' });
    const dinner = expense({
        text: 'Dinner',
        amountCents: 4000,
        personalCents: 2000,
        payment: 'voucher',
        chargeDate: '2026-11-12',
    });
    const DAYS = ['2026-10-25', '2026-11-25', '2026-12-25'];
    const now = () => new Date(2026, 9, 25, 12).getTime();
    const editButton = (name: string) =>
        screen.getByRole('button', { name: t('expenses.list.editItem', { name }) }) as HTMLButtonElement;
    const addToggle = () => screen.getByRole('button', { name: en.expenses.form.title });
    const editToggle = () => screen.getByRole('button', { name: en.expenses.form.editTitle });
    const save = () => fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));
    const cancel = () => fireEvent.click(screen.getByRole('button', { name: en.expenses.form.cancel }));
    const typeIn = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
    const installments = () => field(en.expenses.form.installments) as HTMLSelectElement;
    const partField = (part: number, parts: number, day: string) =>
        field(t('expenses.form.part', { part, parts, date: shown(day) }));

    function sofa(amounts: readonly number[]) {
        const plan = crypto.randomUUID();
        return amounts.map((amountCents, index) =>
            expense({
                text: 'Sofa',
                categoryId: 'housing',
                amountCents,
                date: TODAY,
                payment: 'direct',
                chargeDate: addMonths(TODAY, index),
                plan: { id: plan, part: index + 1, parts: amounts.length },
            })
        );
    }

    async function open(expenses: Expense[], options: Parameters<typeof createFakeApi>[0] = {}) {
        const api = createFakeApi({ ...options, expenses });
        stubApi(api.handler);
        const app = renderApp();
        await screen.findByText(expenses[0]!.text);
        return { api, app };
    }

    function edit(name: string) {
        fireEvent.click(rowToggle(name));
        fireEvent.click(editButton(name));
    }

    afterEach(() => {
        vi.restoreAllMocks();
        document.documentElement.style.removeProperty('--duration-base');
    });

    it('sits next to Delete in the panel of the row', async () => {
        await open([lunch]);

        fireEvent.click(rowToggle('Lunch'));

        const panel = deleteButton('Lunch').closest('.disclosure__panel') as HTMLElement;
        expect(within(panel).getAllByRole('button')).toEqual([editButton('Lunch'), deleteButton('Lunch')]);
        expect(editButton('Lunch').textContent).toBe(en.expenses.list.edit);
        expect(editButton('Lunch').disabled).toBe(false);
    });

    it('loads the expense into the form, under a title and buttons that say so', async () => {
        await open([expense({ text: 'Cinema', categoryId: 'leisure', amountCents: 900, date: '2026-10-20' })]);

        edit('Cinema');

        expect(screen.getByRole('heading', { level: 2, name: en.expenses.form.editTitle })).toBeDefined();
        expect(screen.getByRole('form', { name: en.expenses.form.editTitle })).toBeDefined();
        expect(screen.queryByRole('button', { name: en.expenses.form.title })).toBeNull();
        expect(field(en.expenses.form.amount).value).toBe('9.00');
        expect(field(en.expenses.form.text).value).toBe('Cinema');
        expect(chosenCategory(en.expenses.form.category)).toBe(en.categories.leisure);
        expect(field(en.expenses.form.date).value).toBe('2026-10-20');
        expect(field(en.expenses.form.payment).value).toBe('direct');
        expect(installments().value).toBe('1');
        expect(screen.queryByRole('button', { name: en.expenses.form.submit })).toBeNull();
        expect(screen.getByRole('button', { name: en.expenses.form.save }).getAttribute('type')).toBe('submit');
        expect(screen.getByRole('button', { name: en.expenses.form.cancel }).getAttribute('type')).toBe('button');
    });

    it('saves the same expense, keeping its id and when it was made, as a newer version', async () => {
        const { api } = await open([lunch]);
        edit('Lunch');

        typeIn(en.expenses.form.amount, '14');
        typeIn(en.expenses.form.text, 'Brunch');
        save();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({
            id: lunch.id,
            text: 'Brunch',
            amountCents: 1400,
            createdAt: lunch.createdAt,
            updatedAt: now(),
            deletedAt: null,
        });
        expect(await screen.findByText('Brunch')).toBeDefined();
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('goes back to adding once saved, with the focus on the row it edited', async () => {
        await open([lunch]);
        edit('Lunch');
        typeIn(en.expenses.form.text, 'Brunch');

        save();

        await waitFor(() => expect(screen.queryByRole('button', { name: en.expenses.form.title })).not.toBeNull());
        expect(field(en.expenses.form.amount).value).toBe('');
        expect(field(en.expenses.form.text).value).toBe('');
        expect(screen.queryByRole('button', { name: en.expenses.form.cancel })).toBeNull();
        expect(document.activeElement).toBe(rowToggle('Brunch'));
    });

    it('moves the row to the day it now has, with the focus still on it', async () => {
        const coffee = expense({ text: 'Coffee', date: '2026-10-20' });
        await open([lunch, coffee]);
        expect(document.querySelectorAll('.expense-list__group')).toHaveLength(2);
        edit('Lunch');

        typeIn(en.expenses.form.date, '2026-10-20');
        save();

        await waitFor(() => expect(document.querySelectorAll('.expense-list__group')).toHaveLength(1));
        const group = rowToggle('Lunch').closest('.expense-list__group')!;
        const day = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' });
        expect(group.querySelector('.expense-list__label')!.textContent).toBe(
            day.format(new Date('2026-10-20T12:00:00'))
        );
        expect(within(group as HTMLElement).getByText('Coffee')).toBeDefined();
        expect(document.activeElement).toBe(rowToggle('Lunch'));
        expect(field(en.expenses.form.text).value).toBe('');
    });

    it('says so and stays on the edit when the change cannot be stored on this device', async () => {
        const memory = createMemoryStorage();
        const storage = {
            ...memory,
            set: (key: string, value: unknown) =>
                key.startsWith('tarja:outbox') ? Promise.reject(new Error('quota exceeded')) : memory.set(key, value),
        };
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp({ storage });
        await screen.findByText('Lunch');
        edit('Lunch');

        typeIn(en.expenses.form.text, 'Brunch');
        save();

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.saveFailed);
        expect(editToggle()).toBeDefined();
        expect(field(en.expenses.form.text).value).toBe('Brunch');
        expect(screen.getByRole('button', { name: en.expenses.form.save })).toBeDefined();
        expect(screen.getByRole('button', { name: en.expenses.form.cancel })).toBeDefined();
        expect(rowToggle('Lunch')).toBeDefined();
        expect(screen.queryByText(en.expenses.list.pending)).toBeNull();
    });

    it('goes back to adding on Cancel, saving nothing, with the focus on the row', async () => {
        const { api } = await open([lunch]);
        edit('Lunch');
        typeIn(en.expenses.form.text, 'Brunch');

        cancel();

        expect(addToggle()).toBeDefined();
        expect(field(en.expenses.form.text).value).toBe('');
        expect(document.activeElement).toBe(rowToggle('Lunch'));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.attempts).toHaveLength(0);
    });

    it('puts the focus on the list title when the row is gone once the edit is over', async () => {
        const { api, app } = await open([lunch, expense({ text: 'Coffee' })]);
        edit('Lunch');
        api.serverWrite({ ...lunch, updatedAt: 5_000, deletedAt: 5_000 });
        await app.queryClient.invalidateQueries();
        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());

        cancel();

        expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.expenses.list.title }));
    });

    it('opens the form when it is collapsed, brings it into view and puts the focus on its heading', async () => {
        const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
        await open([lunch]);
        fireEvent.click(addToggle());

        edit('Lunch');

        expect(editToggle().getAttribute('aria-expanded')).toBe('true');
        expect(editToggle().parentElement!.tagName).toBe('H2');
        expect(document.activeElement).toBe(editToggle());
        expect(scroll).toHaveBeenCalledOnce();
        expect(scroll.mock.contexts[0]).toBe(editToggle());
        expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    });

    it('scrolls smoothly to the form while there is motion', async () => {
        document.documentElement.style.setProperty('--duration-base', '200ms');
        const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
        await open([lunch]);

        edit('Lunch');

        expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    it('keeps the saved category whatever the description suggests', async () => {
        const { api } = await open([expense({ text: 'Lunch', categoryId: 'leisure' })]);
        edit('Lunch');

        typeIn(en.expenses.form.text, 'Mercadona');

        expect(chosenCategory(en.expenses.form.category)).toBe(en.categories.leisure);
        expect(screen.queryByText(en.expenses.form.suggested)).toBeNull();
        save();
        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.categoryId).toBe('leisure');
    });

    it('keeps a category that no longer exists, which it shows as the fallback', async () => {
        const gone = crypto.randomUUID();
        const { api, app } = await open([expense({ text: 'Monthly fee', categoryId: gone })]);
        await categoriesLoaded(app);
        edit('Monthly fee');

        expect(chosenCategory(en.expenses.form.category)).toBe(en.categories.other);
        typeIn(en.expenses.form.amount, '35');
        save();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ categoryId: gone, amountCents: 3500 });
    });

    it('saves the category the person picks instead', async () => {
        const { api } = await open([lunch]);
        edit('Lunch');

        pickCategory(en.expenses.form.category, en.categories.health);
        save();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.categoryId).toBe('health');
    });

    it.each(['credit', 'voucher'] as const)('keeps the day a %s payment is charged', async (payment) => {
        const shoes = expense({ text: 'Shoes', payment, chargeDate: '2026-11-30' });
        const { api } = await open([shoes]);
        edit('Shoes');

        expect(field(en.expenses.form.payment).value).toBe(payment);
        expect(field(en.expenses.form.chargeDate).value).toBe('2026-11-30');
        typeIn(en.expenses.form.text, 'Boots');
        save();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ id: shoes.id, payment, chargeDate: '2026-11-30', text: 'Boots' });
    });

    it('loads your part of a restaurant card expense and keeps it', async () => {
        const { api } = await open([dinner]);
        edit('Dinner');

        expect(field(en.expenses.form.personal).value).toBe('20.00');
        expect(screen.getByText(t('expenses.form.paidBack', { amount: '€20.00' }))).toBeDefined();
        typeIn(en.expenses.form.text, 'Dinner for two');
        save();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({
            id: dinner.id,
            text: 'Dinner for two',
            payment: 'voucher',
            amountCents: 4000,
            personalCents: 2000,
            chargeDate: '2026-11-12',
        });
    });

    it('sends no part of your own once a restaurant card expense is paid another way', async () => {
        const { api } = await open([dinner]);
        edit('Dinner');

        fireEvent.change(field(en.expenses.form.payment), { target: { value: 'credit' } });
        save();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({
            id: dinner.id,
            payment: 'credit',
            personalCents: null,
            chargeDate: '2026-11-12',
        });
        expect(v.safeParse(expenseInputSchema, api.writes[0]).issues).toBeUndefined();
    });

    it('loads every payment of a plan', async () => {
        await open(sofa([600, 500, 400]));

        edit('Sofa');

        expect(field(en.expenses.form.amount).value).toBe('15.00');
        expect(installments().value).toBe('3');
        expect(partField(1, 3, DAYS[0]!).value).toBe('6.00');
        expect(partField(2, 3, DAYS[1]!).value).toBe('5.00');
        expect(partField(3, 3, DAYS[2]!).value).toBe('4.00');
        expect(screen.queryByText(/Remaining/)).toBeNull();
    });

    it('offers the number of payments of a plan longer than the form proposes', async () => {
        await open(sofa(Array.from({ length: 18 }, () => 100)));

        edit('Sofa');

        expect(installments().value).toBe('18');
        expect([...installments().options].at(-1)!.textContent).toBe(
            t('expenses.form.installmentsOption', { count: 18 })
        );
    });

    it('saves a plan with fewer payments, deleting the ones it no longer has', async () => {
        const parts = sofa([500, 500, 500]);
        const plan = parts[0]!.plan!.id;
        const { api } = await open(parts);
        edit('Sofa');

        fireEvent.change(installments(), { target: { value: '2' } });
        save();

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(api.writes.map((write) => [write.id, write.plan, write.amountCents, write.deletedAt])).toEqual([
            [parts[0]!.id, { id: plan, part: 1, parts: 2 }, 750, null],
            [parts[1]!.id, { id: plan, part: 2, parts: 2 }, 750, null],
            [parts[2]!.id, parts[2]!.plan, 500, now()],
        ]);
        expect(await screen.findByText(t('expenses.list.plan', { parts: 2, date: shown(DAYS[1]!) }))).toBeDefined();
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('saves a plan with more payments, the new ones under the same plan', async () => {
        const parts = sofa([750, 750]);
        const { api } = await open(parts);
        edit('Sofa');

        fireEvent.change(installments(), { target: { value: '3' } });
        save();

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(new Set(api.writes.map((write) => write.plan?.id))).toEqual(new Set([parts[0]!.plan!.id]));
        expect(
            api.writes.map((write) => [write.plan?.part, write.plan?.parts, write.amountCents, write.chargeDate])
        ).toEqual([
            [1, 3, 500, DAYS[0]],
            [2, 3, 500, DAYS[1]],
            [3, 3, 500, DAYS[2]],
        ]);
        expect(api.writes.slice(0, 2).map((write) => write.id)).toEqual(parts.map((part) => part.id));
        expect(parts.map((part) => part.id)).not.toContain(api.writes[2]!.id);
    });

    it('turns a plan into a credit card payment that keeps the id of the first part', async () => {
        const parts = sofa([500, 500, 500]);
        const { api } = await open(parts);
        edit('Sofa');

        fireEvent.change(field(en.expenses.form.payment), { target: { value: 'credit' } });
        save();

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(api.writes[0]).toMatchObject({
            id: parts[0]!.id,
            payment: 'credit',
            chargeDate: '2026-11-25',
            amountCents: 1500,
            plan: null,
            deletedAt: null,
        });
        expect(api.writes.slice(1).map((write) => [write.id, write.deletedAt])).toEqual([
            [parts[1]!.id, now()],
            [parts[2]!.id, now()],
        ]);
    });

    it('turns a plan into a restaurant card payment with a part of your own, keeping the first part', async () => {
        const parts = sofa([500, 500, 500]);
        const { api } = await open(parts);
        edit('Sofa');

        fireEvent.change(field(en.expenses.form.payment), { target: { value: 'voucher' } });
        expect(field(en.expenses.form.personal).value).toBe('');
        typeIn(en.expenses.form.personal, '5');
        save();

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(api.writes[0]).toMatchObject({
            id: parts[0]!.id,
            payment: 'voucher',
            chargeDate: '2026-11-25',
            amountCents: 1500,
            personalCents: 500,
            plan: null,
            deletedAt: null,
        });
        expect(api.writes.slice(1).map((write) => [write.id, write.deletedAt])).toEqual([
            [parts[1]!.id, now()],
            [parts[2]!.id, now()],
        ]);
        for (const write of api.writes) expect(v.safeParse(expenseInputSchema, write).issues).toBeUndefined();
    });

    it('turns an expense into the first payment of a new plan', async () => {
        const { api } = await open([lunch]);
        edit('Lunch');

        fireEvent.change(installments(), { target: { value: '2' } });
        save();

        await waitFor(() => expect(api.writes).toHaveLength(2));
        expect(api.writes[0]!.id).toBe(lunch.id);
        expect(api.writes[1]!.id).not.toBe(lunch.id);
        expect(api.writes.map((write) => write.plan?.part)).toEqual([1, 2]);
        expect(api.writes[0]!.plan?.id).toBe(api.writes[1]!.plan?.id);
    });

    it('is off for a plan with a payment that is not on this device, saying why', async () => {
        const parts = sofa([500, 500, 500]);
        await open([parts[0]!, parts[1]!]);

        fireEvent.click(rowToggle('Sofa'));

        const reason = screen.getByText(en.expenses.list.editIncomplete);
        expect(editButton('Sofa').disabled).toBe(true);
        expect(editButton('Sofa').getAttribute('aria-describedby')).toBe(reason.id);
        expect(deleteButton('Sofa').disabled).toBe(false);
    });

    it('waits offline with one write for each payment of a plan, and sends them once the connection is back', async () => {
        const parts = sofa([500, 500, 500]);
        const { api, app } = await open(parts);
        onlineManager.setOnline(false);
        edit('Sofa');

        typeIn(en.expenses.form.text, 'Couch');
        save();

        await screen.findByText('Couch');
        expect(app.outbox.getState().pending.map((part) => part.id)).toEqual(parts.map((part) => part.id));
        expect(within(rowToggle('Couch')).getByText(en.expenses.list.pending)).toBeDefined();
        expect(api.attempts).toHaveLength(0);

        onlineManager.setOnline(true);

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(api.writes.every((write) => write.text === 'Couch')).toBe(true);
        await waitFor(() => expect(screen.queryByText(en.expenses.list.pending)).toBeNull());
    });

    it('ends when the expense under edit is deleted', async () => {
        await open([lunch, expense({ text: 'Coffee' })]);
        edit('Lunch');

        fireEvent.click(deleteButton('Lunch'));

        expect(addToggle()).toBeDefined();
        expect(field(en.expenses.form.amount).value).toBe('');
    });

    it('goes on when another expense is deleted', async () => {
        await open([lunch, expense({ text: 'Coffee' })]);
        edit('Lunch');

        deleteExpense('Coffee');

        expect(editToggle()).toBeDefined();
        expect(field(en.expenses.form.text).value).toBe('Lunch');
    });

    it('ends from the header, Expenses collapsing the form and the logo opening it', async () => {
        await open([lunch]);
        edit('Lunch');

        fireEvent.click(screen.getByRole('link', { name: en.nav.expenses }));

        expect(addToggle().getAttribute('aria-expanded')).toBe('false');
        expect(field(en.expenses.form.text).value).toBe('');

        fireEvent.click(editButton('Lunch'));
        expect(editToggle().getAttribute('aria-expanded')).toBe('true');

        fireEvent.click(screen.getByRole('link', { name: 'Tarja' }));

        expect(addToggle().getAttribute('aria-expanded')).toBe('true');
        expect(field(en.expenses.form.text).value).toBe('');
    });

    it('takes the place of a new expense that was being typed, which is gone once the edit is over', async () => {
        await open([lunch]);
        typeIn(en.expenses.form.amount, '3');

        edit('Lunch');
        expect(field(en.expenses.form.amount).value).toBe('12.50');

        cancel();
        expect(field(en.expenses.form.amount).value).toBe('');
    });
});

describe('editing in Spanish', () => {
    const tEs = createTranslator({ locale: 'es', messages: es });
    const dinner = expense({
        text: 'Cena',
        amountCents: 4005,
        personalCents: 2050,
        payment: 'voucher',
        chargeDate: '2026-11-12',
    });
    const fieldEs = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

    beforeEach(() => localStorage.setItem('tarja:locale', 'es'));
    afterEach(() => localStorage.clear());

    async function editDinner() {
        const api = createFakeApi({ expenses: [dinner] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Cena');
        fireEvent.click(rowToggle('Cena'));
        fireEvent.click(screen.getByRole('button', { name: tEs('expenses.list.editItem', { name: 'Cena' }) }));
        return api;
    }

    it('loads the amounts the Spanish way and sends back the cents it was given', async () => {
        const api = await editDinner();

        expect(fieldEs(es.expenses.form.amount).value).toBe('40,05');
        expect(fieldEs(es.expenses.form.personal).value).toBe('20,50');
        fireEvent.change(fieldEs(es.expenses.form.text), { target: { value: 'Cena de dos' } });
        fireEvent.click(screen.getByRole('button', { name: es.expenses.form.save }));

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({
            id: dinner.id,
            text: 'Cena de dos',
            amountCents: 4005,
            personalCents: 2050,
        });
    });

    it('reads an amount typed with a comma', async () => {
        const api = await editDinner();

        fireEvent.change(fieldEs(es.expenses.form.amount), { target: { value: '41,5' } });
        fireEvent.click(screen.getByRole('button', { name: es.expenses.form.save }));

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ amountCents: 4150, personalCents: 2050 });
    });
});

describe('searching, filtering and grouping the list', () => {
    const f = en.expenses.filters;
    const root = document.documentElement;
    const cafe = expense({ text: 'Café con leche', categoryId: 'food', amountCents: 300, date: '2026-10-24' });
    const shop = expense({
        text: 'Weekly shop',
        categoryId: 'groceries',
        amountCents: 4500,
        date: '2026-10-24',
        createdAt: 2_000,
    });
    const cinema = expense({ text: 'Cinema', categoryId: 'leisure', amountCents: 900, date: '2026-10-19' });
    const rent = expense({ text: 'Rent', categoryId: 'housing', amountCents: 60_000, date: '2026-09-30' });
    const list = [cafe, shop, cinema, rent];

    function format(options: Intl.DateTimeFormatOptions, isoDay: string) {
        return new Intl.DateTimeFormat('en', options).format(new Date(`${isoDay}T12:00:00`));
    }

    const longDay = (isoDay: string) => format({ weekday: 'long', day: 'numeric', month: 'long' }, isoDay);

    function sofa(amountCents = 500) {
        const plan = crypto.randomUUID();
        return [1, 2, 3].map((part) =>
            expense({
                text: 'Sofa',
                categoryId: 'housing',
                amountCents,
                date: TODAY,
                payment: 'direct',
                chargeDate: addMonths(TODAY, part - 1),
                plan: { id: plan, part, parts: 3 },
            })
        );
    }

    async function open(expenses: Expense[], first = expenses[0]!.text) {
        const api = createFakeApi({ expenses });
        stubApi(api.handler);
        const app = renderApp();
        await screen.findByText(first);
        return { api, app };
    }

    const searchBox = () => screen.getByRole('searchbox', { name: f.search }) as HTMLInputElement;
    const search = (value: string) => fireEvent.change(searchBox(), { target: { value } });
    const filtersToggle = (count?: number) =>
        screen.getByRole('button', {
            name: count === undefined ? /^Filters/ : t('expenses.filters.toggle', { count }),
        });
    const openFilters = () => {
        if (filtersToggle().getAttribute('aria-expanded') !== 'true') fireEvent.click(filtersToggle());
    };
    const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
    const pickGrouping = (name: string) => {
        openFilters();
        fireEvent.click(radio(name));
    };
    const rowNames = () =>
        screen
            .queryAllByRole('listitem')
            .map((row) => row.querySelector('.expense-item__text')?.textContent)
            .filter(Boolean);
    const groupHeadings = () => screen.queryAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    const subtotalOf = (label: string) =>
        screen
            .getByRole('heading', { level: 3, name: label })
            .nextElementSibling?.textContent?.replace(en.expenses.list.groupTotal, '')
            .trim();
    const statusRegion = () => document.querySelector('.expense-list-controls [role="status"]');
    const clear = () => fireEvent.click(screen.getByRole('button', { name: f.clear }));
    const showing = (shownCount: number, total: number) =>
        screen.queryByText(t('expenses.filters.showing', { shown: shownCount, total }));

    beforeEach(() => localStorage.clear());

    afterEach(() => {
        localStorage.clear();
        root.style.removeProperty('--duration-base');
        vi.restoreAllMocks();
    });

    describe('the controls', () => {
        it('are not there while there are no expenses', async () => {
            stubApi(createFakeApi().handler);

            renderApp();

            await screen.findByText(en.expenses.list.empty);
            expect(screen.queryByRole('searchbox')).toBeNull();
            expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
        });

        it('start with the search and a closed Filters toggle, and nothing else', async () => {
            await open(list);

            expect(searchBox().type).toBe('search');
            expect(filtersToggle().getAttribute('aria-expanded')).toBe('false');
            expect(screen.queryByRole('radio')).toBeNull();
            expect(screen.queryByLabelText(f.from)).toBeNull();
            expect(showing(4, 4)).toBeNull();
            expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
        });

        it('open a panel with the grouping, the category, the dates and how it was paid', async () => {
            await open(list);

            fireEvent.click(filtersToggle());

            const toggle = filtersToggle();
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
            const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
            expect(within(panel).getByRole('group', { name: f.groupBy })).toBeDefined();
            expect(
                within(panel)
                    .getAllByRole('radio')
                    .map((one) => one.getAttribute('value'))
            ).toEqual(['day', 'week', 'month', 'category', 'any', 'direct', 'credit', 'voucher', 'plan']);
            expect(within(panel).getByRole('combobox', { name: f.category }).textContent).toBe(f.allCategories);
            expect((within(panel).getByLabelText(f.from) as HTMLInputElement).value).toBe('');
            expect((within(panel).getByLabelText(f.to) as HTMLInputElement).value).toBe('');
            expect(within(panel).getByRole('group', { name: f.paidWith })).toBeDefined();
            expect(radio(f.group.day).checked).toBe(true);
            expect(radio(f.paid.any).checked).toBe(true);
        });

        it('name how it was paid like the form does', async () => {
            await open(list);
            fireEvent.click(filtersToggle());

            const paidWith = within(screen.getByRole('group', { name: f.paidWith }));

            expect(paidWith.getAllByRole('radio').map((one) => one.parentElement!.textContent)).toEqual([
                f.paid.any,
                en.expenses.payment.direct,
                en.expenses.payment.credit,
                en.expenses.payment.voucher,
                f.paid.plan,
            ]);
        });

        it('close again from the toggle', async () => {
            await open(list);
            fireEvent.click(filtersToggle());

            fireEvent.click(filtersToggle());

            expect(filtersToggle().getAttribute('aria-expanded')).toBe('false');
            expect(screen.queryByRole('radio')).toBeNull();
        });

        it('do not clash with the add form, which keeps its own category field and date', async () => {
            await open(list);
            fireEvent.click(filtersToggle());

            expect(screen.getByRole('combobox', { name: en.expenses.form.category })).not.toBe(
                screen.getByRole('combobox', { name: f.category })
            );
            expect(field(en.expenses.form.date)).not.toBe(screen.getByLabelText(f.from));
        });
    });

    describe('the search', () => {
        it('keeps the rows that have every word, ignoring case and accents', async () => {
            await open(list);

            search('CAFE leche');

            expect(rowNames()).toEqual(['Café con leche']);
        });

        it('finds part of a word', async () => {
            await open(list);

            search('wee');

            expect(rowNames()).toEqual(['Weekly shop']);
        });

        it('looks in the name of the category too', async () => {
            await open(list);

            search('groceries');

            expect(rowNames()).toEqual(['Weekly shop']);
        });

        it('counts a category that no longer exists as Other', async () => {
            await open([expense({ text: 'Monthly fee', categoryId: crypto.randomUUID() }), cafe]);

            search(en.categories.other);

            expect(rowNames()).toEqual(['Monthly fee']);
        });

        it('says how many rows are left, with a button to drop the search', async () => {
            await open(list);

            search('shop');

            expect(showing(1, 4)).not.toBeNull();
            expect(showing(1, 4)!.closest('[role="status"]')).toBe(statusRegion());

            clear();

            expect(rowNames()).toHaveLength(4);
            expect(searchBox().value).toBe('');
            expect(showing(1, 4)).toBeNull();
            expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
        });

        it('says so when nothing matches, and Clear brings the rows back', async () => {
            await open(list);

            search('nothing like this');

            expect(rowNames()).toEqual([]);
            expect(screen.getByText(en.expenses.list.noMatch)).toBeDefined();
            expect(screen.queryByText(en.expenses.list.empty)).toBeNull();
            expect(groupHeadings()).toEqual([]);

            clear();

            expect(rowNames()).toHaveLength(4);
            expect(screen.queryByText(en.expenses.list.noMatch)).toBeNull();
        });

        it('does not narrow the list for a blank search', async () => {
            await open(list);

            search('   ');

            expect(rowNames()).toHaveLength(4);
            expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
        });

        it('does not count in the Filters toggle', async () => {
            await open(list);

            search('shop');

            expect(filtersToggle(0)).toBeDefined();
        });

        it('keeps a plan as one row, found once', async () => {
            await open([...sofa(), cafe]);

            search('sofa');

            expect(rowNames()).toEqual(['Sofa']);
            expect(showing(1, 2)).not.toBeNull();
        });
    });

    describe('the filters', () => {
        it('keep one category', async () => {
            await open(list);
            openFilters();

            pickCategory(f.category, en.categories.groceries);

            expect(rowNames()).toEqual(['Weekly shop']);
            expect(filtersToggle(1)).toBeDefined();
            expect(showing(1, 4)).not.toBeNull();
        });

        it('keep what has no category any more under Other', async () => {
            await open([expense({ text: 'Monthly fee', categoryId: crypto.randomUUID() }), cafe]);
            openFilters();

            pickCategory(f.category, en.categories.other);

            expect(rowNames()).toEqual(['Monthly fee']);
        });

        it('keep the days between two dates, both included', async () => {
            await open(list);
            openFilters();

            fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-10-19' } });
            fireEvent.change(screen.getByLabelText(f.to), { target: { value: '2026-10-24' } });

            expect(rowNames()).toEqual(['Weekly shop', 'Café con leche', 'Cinema']);
            expect(filtersToggle(1)).toBeDefined();

            fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-10-20' } });
            fireEvent.change(screen.getByLabelText(f.to), { target: { value: '2026-10-20' } });

            expect(rowNames()).toEqual([]);
        });

        it('leave a date open when it is cleared', async () => {
            await open(list);
            openFilters();
            fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-10-20' } });
            expect(rowNames()).toEqual(['Weekly shop', 'Café con leche']);

            fireEvent.change(screen.getByLabelText(f.from), { target: { value: '' } });

            expect(rowNames()).toHaveLength(4);
            expect(filtersToggle(0)).toBeDefined();
        });

        it('look at the day an expense was made, not the day it is charged', async () => {
            await open([
                expense({ text: 'Shoes', date: '2026-10-05', payment: 'credit', chargeDate: '2026-11-05' }),
                cafe,
            ]);
            openFilters();

            fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-11-01' } });

            expect(rowNames()).toEqual([]);

            fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-10-01' } });
            fireEvent.change(screen.getByLabelText(f.to), { target: { value: '2026-10-10' } });

            expect(rowNames()).toEqual(['Shoes']);
        });

        it('keep the plans as installments, and what was paid at once as now', async () => {
            await open([
                ...sofa(),
                expense({ text: 'Lunch' }),
                expense({ text: 'Shoes', payment: 'credit', chargeDate: '2026-11-05' }),
                expense({ text: 'Dinner', payment: 'voucher', chargeDate: '2026-11-05' }),
            ]);
            openFilters();

            fireEvent.click(radio(f.paid.plan));
            expect(rowNames()).toEqual(['Sofa']);

            fireEvent.click(radio(en.expenses.payment.direct));
            expect(rowNames()).toEqual(['Lunch']);

            fireEvent.click(radio(en.expenses.payment.credit));
            expect(rowNames()).toEqual(['Shoes']);

            fireEvent.click(radio(en.expenses.payment.voucher));
            expect(rowNames()).toEqual(['Dinner']);
            expect(filtersToggle(1)).toBeDefined();

            fireEvent.click(radio(f.paid.any));
            expect(rowNames()).toHaveLength(4);
        });

        it('combine with each other and with the search', async () => {
            await open(list);
            openFilters();

            pickCategory(f.category, en.categories.groceries);
            fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-10-01' } });
            expect(filtersToggle(2)).toBeDefined();
            expect(rowNames()).toEqual(['Weekly shop']);

            search('cafe');
            expect(rowNames()).toEqual([]);
            expect(screen.getByText(en.expenses.list.noMatch)).toBeDefined();
        });

        it('are all dropped by Clear, which leaves the grouping alone', async () => {
            await open(list);
            pickGrouping(f.group.week);
            search('shop');
            pickCategory(f.category, en.categories.groceries);
            fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-10-01' } });
            fireEvent.click(radio(en.expenses.payment.direct));

            clear();

            expect(rowNames()).toHaveLength(4);
            expect(searchBox().value).toBe('');
            expect(filtersToggle(0)).toBeDefined();
            expect(chosenCategory(f.category)).toBe(f.allCategories);
            expect((screen.getByLabelText(f.from) as HTMLInputElement).value).toBe('');
            expect(radio(f.paid.any).checked).toBe(true);
            expect(radio(f.group.week).checked).toBe(true);
        });

        it('are gone once the screen is left, so a new expense is never hidden by an old filter', async () => {
            await open(list);
            search('shop');
            expect(rowNames()).toEqual(['Weekly shop']);

            fireEvent.click(screen.getByRole('link', { name: en.nav.summary }));
            await screen.findByRole('heading', { name: en.summary.title });
            fireEvent.click(screen.getByRole('link', { name: en.nav.expenses }));

            await screen.findByText('Cinema');
            expect(searchBox().value).toBe('');
            expect(rowNames()).toHaveLength(4);
        });
    });

    describe('the groups', () => {
        it('are days to start with, newest first, each with what its rows add up to', async () => {
            await open(list);

            expect(groupHeadings()).toEqual([longDay('2026-10-24'), longDay('2026-10-19'), longDay('2026-09-30')]);
            expect(subtotalOf(longDay('2026-10-24'))).toBe('€48.00');
            expect(subtotalOf(longDay('2026-10-19'))).toBe('€9.00');
            expect(subtotalOf(longDay('2026-09-30'))).toBe('€600.00');
        });

        it('add up only the rows that are left', async () => {
            await open(list);

            search('cafe');

            expect(groupHeadings()).toEqual([longDay('2026-10-24')]);
            expect(subtotalOf(longDay('2026-10-24'))).toBe('€3.00');
        });

        it('count a plan once, at its full price, on the day it was bought', async () => {
            await open([...sofa(400), expense({ text: 'Lunch', amountCents: 1000, date: TODAY })]);

            expect(groupHeadings()).toEqual([longDay(TODAY)]);
            expect(subtotalOf(longDay(TODAY))).toBe('€22.00');
        });

        it('count a restaurant card expense at your part, on the day it was made', async () => {
            await open([
                expense({
                    text: 'Dinner',
                    amountCents: 4000,
                    personalCents: 1500,
                    payment: 'voucher',
                    chargeDate: '2026-11-12',
                    date: '2026-10-24',
                }),
                expense({
                    text: 'Shoes',
                    amountCents: 9000,
                    payment: 'credit',
                    chargeDate: '2026-12-01',
                    date: '2026-10-24',
                }),
            ]);

            expect(groupHeadings()).toEqual([longDay('2026-10-24')]);
            expect(subtotalOf(longDay('2026-10-24'))).toBe('€105.00');
        });

        it('are weeks from Monday, called after that Monday', async () => {
            await open(list);

            pickGrouping(f.group.week);

            expect(groupHeadings()).toEqual([
                t('expenses.list.weekOf', { date: format({ month: 'short', day: 'numeric' }, '2026-10-19') }),
                t('expenses.list.weekOf', { date: format({ month: 'short', day: 'numeric' }, '2026-09-28') }),
            ]);
            expect(subtotalOf(groupHeadings()[0]!)).toBe('€57.00');
            expect(subtotalOf(groupHeadings()[1]!)).toBe('€600.00');
        });

        it('are months, called by their name', async () => {
            await open(list);

            pickGrouping(f.group.month);

            expect(groupHeadings()).toEqual(['October', 'September']);
            expect(subtotalOf('October')).toBe('€57.00');
        });

        it('add the year to the label when they go over a New Year', async () => {
            await open([
                expense({ text: 'January', date: '2026-01-02' }),
                expense({ text: 'December', date: '2025-12-30' }),
            ]);

            expect(groupHeadings()).toEqual([
                format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, '2026-01-02'),
                format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, '2025-12-30'),
            ]);

            pickGrouping(f.group.month);

            expect(groupHeadings()).toEqual(['January 2026', 'December 2025']);
        });

        it('are categories, the biggest subtotal first, each with its icon and name', async () => {
            await open(list);

            pickGrouping(f.group.category);

            expect(groupHeadings()).toEqual([
                en.categories.housing,
                en.categories.groceries,
                en.categories.leisure,
                en.categories.food,
            ]);
            expect(subtotalOf(en.categories.housing)).toBe('€600.00');
            const heading = screen.getByRole('heading', { level: 3, name: en.categories.groceries });
            expect(heading.querySelector('.category-badge')).not.toBeNull();
        });

        it('put a category that no longer exists under Other, and leave the expense as it was', async () => {
            const gone = crypto.randomUUID();
            const { api } = await open([expense({ text: 'Monthly fee', categoryId: gone }), cafe]);

            pickGrouping(f.group.category);

            expect(groupHeadings()).toEqual([en.categories.other, en.categories.food]);
            expect(rowNames()).toContain('Monthly fee');
            expect(api.writes).toHaveLength(0);
        });

        it('show the day an expense was made in its details, unless they are days', async () => {
            await open([cafe]);
            const row = () => screen.getByText('Café con leche').closest('li')!;
            expect(row().textContent).not.toContain(shown('2026-10-24'));

            pickGrouping(f.group.week);
            expect(row().textContent).toContain(shown('2026-10-24'));

            fireEvent.click(radio(f.group.category));
            expect(row().textContent).toContain(shown('2026-10-24'));

            fireEvent.click(radio(f.group.day));
            expect(row().textContent).not.toContain(shown('2026-10-24'));
        });

        it('keep a restaurant card expense and a plan as one row each, with their own totals', async () => {
            await open([...sofa(500), expense({ text: 'Lunch', amountCents: 1250, date: TODAY })]);

            pickGrouping(f.group.category);

            expect(rowNames()).toHaveLength(2);
            expect(screen.getByText('Sofa').closest('li')!.textContent).toContain('€15.00');
        });
    });

    describe('the grouping', () => {
        it('is remembered in the browser', async () => {
            await open(list);

            pickGrouping(f.group.month);

            expect(localStorage.getItem('tarja:list-grouping')).toBe('month');
        });

        it('is the one chosen the last time', async () => {
            const { app } = await open(list);
            pickGrouping(f.group.month);
            app.unmount();

            renderApp();
            await screen.findByText('Cinema');

            expect(groupHeadings()).toEqual(['October', 'September']);
            fireEvent.click(filtersToggle());
            expect(radio(f.group.month).checked).toBe(true);
        });

        it('falls back to days for something nobody saved', async () => {
            localStorage.setItem('tarja:list-grouping', 'year');

            await open(list);

            expect(groupHeadings()).toHaveLength(3);
            expect(groupHeadings()[0]).toBe(longDay('2026-10-24'));
        });

        it('still works when the browser will not keep it', async () => {
            const getItem = Storage.prototype.getItem;
            const setItem = Storage.prototype.setItem;
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
                if (key === 'tarja:list-grouping') throw new Error('blocked');
                return getItem.call(this, key);
            });
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
                this: Storage,
                key: string,
                value: string
            ) {
                if (key === 'tarja:list-grouping') throw new Error('blocked');
                setItem.call(this, key, value);
            });
            await open(list);

            pickGrouping(f.group.month);

            expect(groupHeadings()).toEqual(['October', 'September']);
        });
    });

    describe('Show more', () => {
        function many(count: number) {
            return Array.from({ length: count }, (_, index) =>
                expense({
                    text: `Item ${String(index).padStart(3, '0')}`,
                    amountCents: 100,
                    createdAt: 10_000 + index,
                })
            );
        }
        const showMore = () => screen.queryByRole('button', { name: en.expenses.list.showMore });

        it('is not offered for a short list', async () => {
            await open(many(100), 'Item 099');

            expect(rowNames()).toHaveLength(100);
            expect(showMore()).toBeNull();
        });

        it('draws 100 rows and adds 100 more each time it is pressed', async () => {
            await open(many(230), 'Item 229');
            expect(rowNames()).toHaveLength(100);

            fireEvent.click(showMore()!);
            expect(rowNames()).toHaveLength(200);

            fireEvent.click(showMore()!);
            expect(rowNames()).toHaveLength(230);
            expect(showMore()).toBeNull();
        });

        it('adds up the whole group, also the rows that are not drawn yet', async () => {
            await open(many(150), 'Item 149');

            expect(subtotalOf(longDay('2026-10-24'))).toBe('€150.00');
        });

        it('starts over at 100 when the list changes', async () => {
            await open(many(230), 'Item 229');
            fireEvent.click(showMore()!);
            expect(rowNames()).toHaveLength(200);

            search('item');

            expect(rowNames()).toHaveLength(100);
            expect(showMore()).not.toBeNull();
        });

        it('counts the rows that pass the filters, not the ones that do not', async () => {
            await open(many(230), 'Item 229');

            search('item 22');

            expect(rowNames()).toHaveLength(12);
            expect(showMore()).toBeNull();
            expect(showing(12, 230)).not.toBeNull();
        });
    });

    describe('deleting and editing', () => {
        it('fades a deleted row out under a filter, and then says nothing matches', async () => {
            root.style.setProperty('--duration-base', '60ms');
            await open([cafe, shop]);
            search('shop');

            deleteExpense('Weekly shop');

            expect(screen.getByText('Weekly shop').closest('li')!.className).toContain('expense-item--leaving');
            await waitFor(() => expect(screen.queryByText('Weekly shop')).toBeNull());
            expect(screen.getByText(en.expenses.list.noMatch)).toBeDefined();
        });

        it('counts the row that fades with the others the filter keeps', async () => {
            root.style.setProperty('--duration-base', '60000ms');
            await open([
                expense({ text: 'Lunch A', createdAt: 3_000 }),
                expense({ text: 'Lunch B', createdAt: 2_000 }),
                expense({ text: 'Dinner', createdAt: 1_000 }),
            ]);
            search('lunch');

            deleteExpense('Lunch A');

            expect(rowNames()).toEqual(['Lunch A', 'Lunch B']);
            expect(showing(2, 3)).not.toBeNull();
        });

        it('takes away the controls once the last expense is deleted', async () => {
            root.style.setProperty('--duration-base', '0ms');
            await open([cafe]);

            deleteExpense('Café con leche');

            await screen.findByText(en.expenses.list.empty);
            expect(screen.queryByRole('searchbox')).toBeNull();
        });

        it('edits the whole plan, not the part the filter looked at', async () => {
            await open([...sofa(), cafe]);
            search('sofa');

            fireEvent.click(rowToggle('Sofa'));
            fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Sofa' }) }));

            expect((field(en.expenses.form.installments) as HTMLSelectElement).value).toBe('3');
            expect(field(t('expenses.form.part', { part: 3, parts: 3, date: shown(addMonths(TODAY, 2)) })).value).toBe(
                '5.00'
            );
        });

        it('gives the focus back to the row it edited when the filter still shows it', async () => {
            await open([cafe, shop]);
            search('shop');
            fireEvent.click(rowToggle('Weekly shop'));
            fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Weekly shop' }) }));

            fireEvent.click(screen.getByRole('button', { name: en.expenses.form.cancel }));

            expect(document.activeElement).toBe(rowToggle('Weekly shop'));
        });

        it('gives the focus to the list title when the filter hides the row it edited', async () => {
            await open([cafe, shop]);
            fireEvent.click(rowToggle('Weekly shop'));
            fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Weekly shop' }) }));
            search('cafe');
            expect(screen.queryByText('Weekly shop')).toBeNull();

            fireEvent.click(screen.getByRole('button', { name: en.expenses.form.cancel }));

            expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.expenses.list.title }));
        });
    });

    describe('a filter that would hide a new expense', () => {
        it('is dropped by adding an expense, so the new row shows, and the grouping stays', async () => {
            const { api } = await open([cafe, shop]);
            pickGrouping(f.group.week);
            pickCategory(f.category, en.categories.food);
            search('cafe');
            expect(rowNames()).toEqual(['Café con leche']);

            fillAndSubmit({ amount: '2', text: 'Beers' });

            await waitFor(() => expect(api.writes).toHaveLength(1));
            await waitFor(() => expect(rowNames()).toContain('Beers'));
            expect(rowNames()).toHaveLength(3);
            expect(searchBox().value).toBe('');
            expect(filtersToggle(0)).toBeDefined();
            expect(chosenCategory(f.category)).toBe(f.allCategories);
            expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
            expect(radio(f.group.week).checked).toBe(true);
            expect(localStorage.getItem('tarja:list-grouping')).toBe('week');
        });

        it('is not dropped when the form refuses the expense', async () => {
            const { api } = await open([cafe, shop]);
            search('cafe');

            fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));

            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(api.writes).toHaveLength(0);
            expect(searchBox().value).toBe('cafe');
        });

        it('is not dropped by the edit of an expense', async () => {
            await open([cafe, shop]);
            search('cafe');
            fireEvent.click(rowToggle('Café con leche'));
            fireEvent.click(
                screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Café con leche' }) })
            );

            fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

            await waitFor(() => expect(document.activeElement).toBe(rowToggle('Café con leche')));
            expect(searchBox().value).toBe('cafe');
        });

        it('is dropped once no expense is left, so the next one that arrives is not hidden', async () => {
            root.style.setProperty('--duration-base', '0ms');
            const { app } = await open([cafe]);
            search('cafe');
            openFilters();
            pickCategory(f.category, en.categories.food);

            deleteExpense('Café con leche');
            await screen.findByText(en.expenses.list.empty);
            await app.outbox.put(expense({ text: 'Tea', categoryId: 'leisure' }));

            await waitFor(() => expect(rowNames()).toEqual(['Tea']));
            expect(searchBox().value).toBe('');
            expect(filtersToggle(0)).toBeDefined();
        });

        it('is dropped for an expense added after the last one was deleted', async () => {
            root.style.setProperty('--duration-base', '0ms');
            await open([cafe]);
            search('cafe');

            deleteExpense('Café con leche');
            await screen.findByText(en.expenses.list.empty);
            fillAndSubmit({ amount: '3', text: 'Tea' });

            await waitFor(() => expect(rowNames()).toEqual(['Tea']));
            expect(searchBox().value).toBe('');
        });

        it('is kept when rows arrive from the server while the person is typing', async () => {
            const { api, app } = await open([cafe, shop]);
            search('cafe');

            api.serverWrite(expense({ text: 'Dinner', createdAt: 5_000 }));
            await app.queryClient.invalidateQueries();

            await waitFor(() => expect(showing(1, 3)).not.toBeNull());
            expect(searchBox().value).toBe('cafe');
            expect(rowNames()).toEqual(['Café con leche']);
        });

        it('is kept while the rows it leaves are deleted and others are still there', async () => {
            root.style.setProperty('--duration-base', '0ms');
            await open([cafe, shop]);
            search('shop');

            deleteExpense('Weekly shop');

            await waitFor(() => expect(screen.getByText(en.expenses.list.noMatch)).toBeDefined());
            expect(searchBox().value).toBe('shop');
        });
    });

    describe('the focus', () => {
        it('goes to the search field when Clear is pressed, since the button is gone', async () => {
            await open(list);
            search('shop');

            clear();

            expect(document.activeElement).toBe(searchBox());
        });

        it('goes to the search field when Clear is pressed in the empty result too', async () => {
            await open(list);
            search('nothing like this');

            clear();

            expect(document.activeElement).toBe(searchBox());
            expect(rowNames()).toHaveLength(4);
        });

        it('has a status region that is already there before the count, and fills it', async () => {
            await open(list);
            const region = statusRegion()!;
            expect(region).not.toBeNull();
            expect(region.textContent).toBe('');

            search('shop');

            expect(statusRegion()).toBe(region);
            expect(region.textContent).toContain(t('expenses.filters.showing', { shown: 1, total: 4 }));

            clear();

            expect(statusRegion()).toBe(region);
            expect(region.textContent).toBe('');
        });

        it('keeps the empty status region out of the layout of the controls', async () => {
            await open(list);

            expect(statusRegion()!.parentElement!.className).toContain('expense-list-controls__status--idle');

            search('shop');

            expect(statusRegion()!.parentElement!.className).not.toContain('expense-list-controls__status--idle');
        });
    });

    describe('the group labels', () => {
        it('are plain text for a date, which keeps its capital letter, and a row of icon and name for a category', async () => {
            await open(list);
            const heading = () => screen.getAllByRole('heading', { level: 3 })[0]!;

            expect(heading().className).toContain('expense-list__label--date');
            expect(heading().className).not.toContain('expense-list__label--category');

            pickGrouping(f.group.category);

            expect(heading().className).toContain('expense-list__label--category');
            expect(heading().className).not.toContain('expense-list__label--date');
        });

        it('are followed by a subtotal that a screen reader hears as a total', async () => {
            await open(list);

            const subtotal = screen.getByRole('heading', { level: 3, name: longDay('2026-10-24') }).nextElementSibling!;

            expect(subtotal.querySelector('.visually-hidden')?.textContent).toBe(en.expenses.list.groupTotal);
            expect(subtotal.textContent).toBe(`${en.expenses.list.groupTotal} €48.00`);
        });
    });

    describe('editing under a search', () => {
        function editRow(name: string) {
            fireEvent.click(rowToggle(name));
            fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name }) }));
        }

        it('lists an expense whose edited text now matches', async () => {
            await open([cafe, shop]);
            search('cafe');
            expect(rowNames()).toEqual(['Café con leche']);

            editRow('Café con leche');
            fireEvent.change(field(en.expenses.form.text), { target: { value: 'Tea' } });
            fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

            await waitFor(() => expect(screen.getByText(en.expenses.list.noMatch)).toBeDefined());
            expect(rowNames()).toEqual([]);
            expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.expenses.list.title }));

            search('tea');

            expect(rowNames()).toEqual(['Tea']);
        });

        it('stops listing an expense whose text it changed to something that does not match, and lists another that does', async () => {
            await open([cafe, shop]);
            search('cafe');

            editRow('Café con leche');
            fireEvent.change(field(en.expenses.form.text), { target: { value: 'Cafe run' } });
            fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

            await waitFor(() => expect(rowNames()).toEqual(['Cafe run']));
            expect(showing(1, 2)).not.toBeNull();
            await waitFor(() => expect(document.activeElement).toBe(rowToggle('Cafe run')));
        });
    });

    describe('the cap and the focus', () => {
        function many(count: number) {
            return Array.from({ length: count }, (_, index) =>
                expense({ text: `Item ${String(index).padStart(3, '0')}`, createdAt: 10_000 + index })
            );
        }

        it('goes to the list title when an edit moves the row beyond the rows that are drawn', async () => {
            await open(many(150), 'Item 149');
            fireEvent.click(rowToggle('Item 149'));
            fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Item 149' }) }));
            fireEvent.change(field(en.expenses.form.date), { target: { value: '2026-01-01' } });

            fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

            await waitFor(() => expect(screen.queryByText('Item 149')).toBeNull());
            expect(rowNames()).toHaveLength(100);
            await waitFor(() =>
                expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.expenses.list.title }))
            );
        });

        it('goes to the first row that Show more brings in', async () => {
            await open(many(230), 'Item 229');

            fireEvent.click(screen.getByRole('button', { name: en.expenses.list.showMore }));

            expect(rowNames()).toHaveLength(200);
            expect(document.activeElement).toBe(rowToggle('Item 129'));
        });

        it('goes to the first row of the last ones too, when the button is gone', async () => {
            await open(many(230), 'Item 229');
            fireEvent.click(screen.getByRole('button', { name: en.expenses.list.showMore }));

            fireEvent.click(screen.getByRole('button', { name: en.expenses.list.showMore }));

            expect(screen.queryByRole('button', { name: en.expenses.list.showMore })).toBeNull();
            expect(rowNames()).toHaveLength(230);
            expect(document.activeElement).toBe(rowToggle('Item 029'));
        });
    });
});
