import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { chosenPayment, expense, field, fillAndSubmit, pickPayment, shown, t, TODAY } from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { optionNames, chosenOption, pickOption } from '@/lib/testing/select';
import { ensureAddSheet, openAddSheet } from '@/lib/testing/sheet';

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

describe('expense form', () => {
    it('starts on today', async () => {
        stubApi(createFakeApi().handler);

        renderApp();
        const dialog = await openAddSheet();

        expect((within(dialog).getByLabelText(en.expenses.form.date) as HTMLInputElement).value).toBe(TODAY);
    });

    it('suggests a category while the description is typed', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await openAddSheet();

        fireEvent.change(field(en.expenses.form.text), { target: { value: 'Mercadona' } });

        expect(chosenOption(en.expenses.form.category)).toBe(en.categories.groceries);
        expect(screen.getByText(en.expenses.form.suggested)).toBeDefined();
    });

    it.each([
        ['Hotel en Lisboa', 'treats'],
        ['Peluquería', 'personal'],
        ['Regalo de cumpleaños', 'gifts'],
    ] as const)('suggests %s as %s', async (text, categoryId) => {
        stubApi(createFakeApi().handler);
        renderApp();
        await openAddSheet();

        fireEvent.change(field(en.expenses.form.text), { target: { value: text } });

        expect(chosenOption(en.expenses.form.category)).toBe(en.categories[categoryId]);
        expect(screen.getByText(en.expenses.form.suggested)).toBeDefined();
    });

    it('stops suggesting once the user picks a category', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await openAddSheet();

        pickOption(en.expenses.form.category, en.categories.leisure);
        fireEvent.change(field(en.expenses.form.text), { target: { value: 'Mercadona' } });

        expect(chosenOption(en.expenses.form.category)).toBe(en.categories.leisure);
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

    it('starts the next expense empty and on today after one is saved', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        fireEvent.change(field(en.expenses.form.date), { target: { value: '2026-10-20' } });

        fillAndSubmit({ amount: '3', text: 'Coffee' });

        await screen.findByRole('listitem');
        expect(field(en.expenses.form.amount).value).toBe('');
        expect(field(en.expenses.form.text).value).toBe('');
        expect(field(en.expenses.form.date).value).toBe(TODAY);
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

    it('keeps Add on with nothing typed, and marks the amount with the focus on it when it is pressed', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        ensureAddSheet();
        const add = screen.getByRole('button', { name: en.expenses.form.submit }) as HTMLButtonElement;

        expect(add.disabled).toBe(false);
        fireEvent.click(add);

        const amount = field(en.expenses.form.amount);
        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.amountInvalid);
        expect(amount.getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(amount);
        expect(api.writes).toHaveLength(0);

        fireEvent.change(amount, { target: { value: '5' } });
        expect(amount.getAttribute('aria-invalid')).toBe('false');
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('folds the day and the payment under More options, saying what they hold while it is closed', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        ensureAddSheet();

        const toggle = screen.getByRole('button', { name: new RegExp(`^${en.expenses.form.moreOptions}`) });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.textContent).toBe(
            `${en.expenses.form.moreOptions}${en.expenses.form.today} · ${en.expenses.payment.direct}`
        );
        expect(screen.queryByRole('combobox', { name: en.expenses.form.payment })).toBeNull();

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(toggle.textContent).toBe(en.expenses.form.moreOptions);
        expect(screen.getByRole('combobox', { name: en.expenses.form.payment })).toBeDefined();
    });

    it('opens More options when what is to fix is there, with the focus on it', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        fireEvent.change(field(en.expenses.form.amount), { target: { value: '5' } });
        fireEvent.change(field(en.expenses.form.date), { target: { value: '' } });
        const toggle = screen.getByRole('button', { name: new RegExp(`^${en.expenses.form.moreOptions}`) });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.dateInvalid);
        expect(document.activeElement).toBe(field(en.expenses.form.date));
        expect(api.writes).toHaveLength(0);
    });

    it('folds More options again once an expense is added', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        pickPayment('credit');
        const toggle = screen.getByRole('button', { name: new RegExp(`^${en.expenses.form.moreOptions}`) });
        expect(toggle.getAttribute('aria-expanded')).toBe('true');

        fillAndSubmit({ amount: '5', text: 'Lunch' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        ensureAddSheet();
        expect(
            screen
                .getByRole('button', { name: new RegExp(`^${en.expenses.form.moreOptions}`) })
                .getAttribute('aria-expanded')
        ).toBe('false');
    });
});

describe('deferred expenses', () => {
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

        expect(chosenPayment()).toBe(en.expenses.payment.direct);
        expect(screen.queryByLabelText(en.expenses.form.chargeDate)).toBeNull();
        expect(optionNames(en.expenses.form.payment)).toEqual([
            en.expenses.payment.direct,
            en.expenses.payment.credit,
            en.expenses.payment.voucher,
        ]);
    });

    it.each(['credit', 'voucher'] as const)(
        'ask when a %s expense is charged, proposing the next month',
        async (payment) => {
            await open();

            pickPayment(payment);

            expect(chargeField().value).toBe('2026-11-25');
        }
    );

    it('follow the day of the expense until the person picks another charge date', async () => {
        await open();
        pickPayment('credit');

        inputDate('2026-01-31');
        expect(chargeField().value).toBe('2026-02-28');

        fireEvent.change(chargeField(), { target: { value: '2026-03-05' } });
        inputDate('2026-01-30');
        expect(chargeField().value).toBe('2026-03-05');
    });

    it('are saved with how they were paid and when they are charged', async () => {
        const api = await open();
        pickPayment('credit');

        fillAndSubmit({ amount: '40', text: 'Shoes' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ date: TODAY, payment: 'credit', chargeDate: '2026-11-25' });
    });

    it('are saved on the charge date the person picked', async () => {
        const api = await open();
        pickPayment('voucher');
        fireEvent.change(chargeField(), { target: { value: '2026-12-01' } });

        fillAndSubmit({ amount: '9', text: 'Menu' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ payment: 'voucher', chargeDate: '2026-12-01' });
    });

    it('send no charge date once the person goes back to paying at once', async () => {
        const api = await open();
        pickPayment('credit');
        pickPayment('direct');

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
        pickPayment('credit');
        fireEvent.change(chargeField(), { target: { value: '2026-10-24' } });

        fillAndSubmit({ amount: '40', text: 'Shoes' });

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.chargeDateInvalid);
        expect(api.writes).toHaveLength(0);
        expect(field(en.expenses.form.amount).value).toBe('40');
    });

    it('puts the message about the charge date under the charge date', async () => {
        await open();
        pickPayment('credit');
        fireEvent.change(chargeField(), { target: { value: '2026-10-24' } });

        fillAndSubmit({ amount: '40', text: 'Shoes' });

        const alert = await screen.findByRole('alert');
        expect(alert.parentElement).toBe(chargeField().closest('.field'));
        expect(chargeField().getAttribute('aria-describedby')).toBe(alert.id);
    });

    it('go back to being paid at once after one is saved', async () => {
        await open();
        pickPayment('credit');
        fillAndSubmit({ amount: '40', text: 'Shoes' });
        await screen.findByRole('listitem');

        expect(chosenPayment()).toBe(en.expenses.payment.direct);
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
    const personalField = () => field(en.expenses.form.personal) as HTMLInputElement;
    const pay = pickPayment;
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
