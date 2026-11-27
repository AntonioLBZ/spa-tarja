import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import {
    categoriesLoaded,
    chosenInstallments,
    chosenPayment,
    deleteButton,
    expense,
    field,
    installmentsLabel,
    pickInstallments,
    pickPayment,
    rowToggle,
    shown,
    t,
    TODAY,
} from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { createMemoryStorage } from '@/lib/testing/memory-storage';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { optionNames, chosenOption, pickOption } from '@/lib/testing/select';
import { closeSheet } from '@/lib/testing/sheet';
import { addMonths } from '@core/basics/date';
import { expenseInputSchema, type Expense } from '@core/expenses/expense';

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
    const editSheet = () => screen.getByRole('dialog', { name: en.expenses.form.editTitle });
    const save = () => fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));
    const cancel = () => fireEvent.click(screen.getByRole('button', { name: en.expenses.form.cancel }));
    const typeIn = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
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
        expect(within(panel).getAllByRole('button')).toEqual([
            editButton('Lunch'),
            screen.getByRole('button', { name: t('expenses.list.duplicateItem', { name: 'Lunch' }) }),
            deleteButton('Lunch'),
        ]);
        expect(editButton('Lunch').textContent).toBe(en.expenses.list.edit);
        expect(editButton('Lunch').disabled).toBe(false);
    });

    it('opens More options for an expense paid by card, and keeps it folded for one made today and paid now', async () => {
        await open([
            expense({ text: 'Cinema', amountCents: 900, date: TODAY }),
            expense({ text: 'Shoes', amountCents: 6000, date: TODAY, payment: 'credit', chargeDate: '2026-11-25' }),
        ]);
        const toggle = () => screen.getByRole('button', { name: new RegExp(`^${en.expenses.form.moreOptions}`) });

        edit('Cinema');
        expect(toggle().getAttribute('aria-expanded')).toBe('false');
        cancel();

        edit('Shoes');
        expect(toggle().getAttribute('aria-expanded')).toBe('true');
        expect(chosenPayment()).toBe(en.expenses.payment.credit);
    });

    it('loads the expense into the form, under a title and buttons that say so', async () => {
        await open([expense({ text: 'Cinema', categoryId: 'leisure', amountCents: 900, date: '2026-10-20' })]);

        edit('Cinema');

        expect(screen.getByRole('heading', { level: 2, name: en.expenses.form.editTitle })).toBeDefined();
        expect(screen.getByRole('form', { name: en.expenses.form.editTitle })).toBeDefined();
        expect(field(en.expenses.form.amount).value).toBe('9.00');
        expect(field(en.expenses.form.text).value).toBe('Cinema');
        expect(chosenOption(en.expenses.form.category)).toBe(en.categories.leisure);
        expect(field(en.expenses.form.date).value).toBe('2026-10-20');
        expect(chosenPayment()).toBe(en.expenses.payment.direct);
        expect(chosenInstallments()).toBe(installmentsLabel(1));
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

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(screen.queryByRole('button', { name: en.expenses.form.cancel })).toBeNull();
        expect(document.activeElement).toBe(rowToggle('Brunch'));
        expect(field(en.expenses.form.amount).value).toBe('');
        expect(field(en.expenses.form.text).value).toBe('');
    });

    it('moves the row to the day it now has, with the focus still on it', async () => {
        const coffee = expense({ text: 'Coffee', date: '2026-10-20' });
        await open([lunch, coffee]);
        expect(document.querySelectorAll('.sheet')).toHaveLength(2);
        edit('Lunch');

        typeIn(en.expenses.form.date, '2026-10-20');
        save();

        await waitFor(() => expect(document.querySelectorAll('.sheet')).toHaveLength(1));
        const group = rowToggle('Lunch').closest('.sheet')!;
        const day = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' });
        expect(group.querySelector('.sheet__label')!.textContent).toBe(day.format(new Date('2026-10-20T12:00:00')));
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
        expect(editSheet()).toBeDefined();
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

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(rowToggle('Lunch'));
        expect(field(en.expenses.form.text).value).toBe('');
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

    it('keeps the saved category whatever the description suggests', async () => {
        const { api } = await open([expense({ text: 'Lunch', categoryId: 'leisure' })]);
        edit('Lunch');

        typeIn(en.expenses.form.text, 'Mercadona');

        expect(chosenOption(en.expenses.form.category)).toBe(en.categories.leisure);
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

        expect(chosenOption(en.expenses.form.category)).toBe(en.categories.other);
        typeIn(en.expenses.form.amount, '35');
        save();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ categoryId: gone, amountCents: 3500 });
    });

    it('saves the category the person picks instead', async () => {
        const { api } = await open([lunch]);
        edit('Lunch');

        pickOption(en.expenses.form.category, en.categories.health);
        save();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.categoryId).toBe('health');
    });

    it.each(['credit', 'voucher'] as const)('keeps the day a %s payment is charged', async (payment) => {
        const shoes = expense({ text: 'Shoes', payment, chargeDate: '2026-11-30' });
        const { api } = await open([shoes]);
        edit('Shoes');

        expect(chosenPayment()).toBe(en.expenses.payment[payment]);
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

        pickPayment('credit');
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
        expect(chosenInstallments()).toBe(installmentsLabel(3));
        expect(partField(1, 3, DAYS[0]!).value).toBe('6.00');
        expect(partField(2, 3, DAYS[1]!).value).toBe('5.00');
        expect(partField(3, 3, DAYS[2]!).value).toBe('4.00');
        expect(screen.queryByText(/Remaining/)).toBeNull();
    });

    it('offers the number of payments of a plan longer than the form proposes', async () => {
        await open(sofa(Array.from({ length: 18 }, () => 100)));

        edit('Sofa');

        expect(chosenInstallments()).toBe(installmentsLabel(18));
        expect(optionNames(en.expenses.form.installments).at(-1)).toBe(installmentsLabel(18));
    });

    it('saves a plan with fewer payments, deleting the ones it no longer has', async () => {
        const parts = sofa([500, 500, 500]);
        const plan = parts[0]!.plan!.id;
        const { api } = await open(parts);
        edit('Sofa');

        pickInstallments(2);
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

        pickInstallments(3);
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

        pickPayment('credit');
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

        pickPayment('voucher');
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

        pickInstallments(2);
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

    it('takes the place of a new expense that was being typed, which is gone once the edit is over', async () => {
        await open([lunch]);
        typeIn(en.expenses.form.amount, '3');
        await closeSheet();

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
