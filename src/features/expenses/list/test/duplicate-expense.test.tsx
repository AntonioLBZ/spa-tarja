import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import {
    chosenInstallments,
    chosenPayment,
    deleteButton,
    expense,
    field,
    installmentsLabel,
    rowToggle,
    shown,
    t,
    TODAY,
} from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { createMemoryStorage } from '@/lib/testing/memory-storage';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { chosenOption } from '@/lib/testing/select';
import { closeSheet } from '@/lib/testing/sheet';
import { addMonths } from '@core/basics/date';
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

describe('duplicating an expense', () => {
    const lunch = expense({ text: 'Lunch', categoryId: 'leisure', amountCents: 1250, date: '2026-10-20' });
    const dinner = expense({
        text: 'Dinner',
        amountCents: 4000,
        personalCents: 2000,
        payment: 'voucher',
        chargeDate: '2026-11-12',
        date: '2026-10-20',
    });
    const copySheet = () => screen.getByRole('dialog', { name: en.expenses.form.copyTitle });
    const add = () => fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));
    const cancel = () => fireEvent.click(screen.getByRole('button', { name: en.expenses.form.cancel }));
    const typeIn = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
    const duplicateButton = (name: string) =>
        screen.getByRole('button', { name: t('expenses.list.duplicateItem', { name }) }) as HTMLButtonElement;
    const partField = (part: number, parts: number, day: string) =>
        field(t('expenses.form.part', { part, parts, date: shown(day) }));
    const NOW = new Date(2026, 9, 25, 12).getTime();

    function sofa(amounts: readonly number[]) {
        const plan = crypto.randomUUID();
        return amounts.map((amountCents, index) =>
            expense({
                text: 'Sofa',
                categoryId: 'housing',
                amountCents,
                date: '2026-10-01',
                chargeDate: addMonths('2026-10-01', index),
                plan: { id: plan, part: index + 1, parts: amounts.length },
            })
        );
    }

    async function open(expenses: Expense[]) {
        const api = createFakeApi({ expenses });
        stubApi(api.handler);
        const app = renderApp();
        await screen.findByText(expenses[0]!.text);
        return { api, app };
    }

    function duplicate(name: string) {
        fireEvent.click(rowToggle(name));
        fireEvent.click(duplicateButton(name));
    }

    afterEach(() => {
        vi.restoreAllMocks();
        document.documentElement.style.removeProperty('--duration-base');
    });

    it('is a button in the panel of the row, named for the expense', async () => {
        await open([lunch]);

        fireEvent.click(rowToggle('Lunch'));

        expect(duplicateButton('Lunch').textContent).toBe(en.expenses.list.duplicate);
        expect(duplicateButton('Lunch').disabled).toBe(false);
    });

    it('is off for a plan with a payment that is not on this device, under the same notice as Edit', async () => {
        const parts = sofa([500, 500, 500]);
        await open([parts[0]!, parts[1]!]);

        fireEvent.click(rowToggle('Sofa'));

        const reason = screen.getByText(en.expenses.list.editIncomplete);
        expect(duplicateButton('Sofa').disabled).toBe(true);
        expect(duplicateButton('Sofa').getAttribute('aria-describedby')).toBe(reason.id);
        expect(deleteButton('Sofa').disabled).toBe(false);
    });

    it('opens the form as a new expense, under a title and buttons that say so', async () => {
        await open([lunch]);

        duplicate('Lunch');

        expect(screen.getByRole('heading', { level: 2, name: en.expenses.form.copyTitle })).toBeDefined();
        expect(screen.getByRole('form', { name: en.expenses.form.copyTitle })).toBeDefined();
        expect(screen.queryByRole('dialog', { name: en.expenses.form.editTitle })).toBeNull();
        expect(screen.queryByRole('button', { name: en.expenses.form.save })).toBeNull();
        expect(screen.getByRole('button', { name: en.expenses.form.submit }).getAttribute('type')).toBe('submit');
        expect(screen.getByRole('button', { name: en.expenses.form.cancel }).getAttribute('type')).toBe('button');
    });

    it('fills in the text, the category, the amount and how it was paid, with today as the day', async () => {
        await open([lunch]);

        duplicate('Lunch');

        expect(field(en.expenses.form.amount).value).toBe('12.50');
        expect(field(en.expenses.form.text).value).toBe('Lunch');
        expect(chosenOption(en.expenses.form.category)).toBe(en.categories.leisure);
        expect(screen.queryByText(en.expenses.form.suggested)).toBeNull();
        expect(chosenPayment()).toBe(en.expenses.payment.direct);
        expect(field(en.expenses.form.date).value).toBe(TODAY);
    });

    it('charges a card payment on the day the form proposes for today, not on the original day', async () => {
        await open([expense({ text: 'Shoes', payment: 'credit', chargeDate: '2026-11-02', date: '2026-10-20' })]);

        duplicate('Shoes');

        expect(chosenPayment()).toBe(en.expenses.payment.credit);
        expect(field(en.expenses.form.chargeDate).value).toBe(addMonths(TODAY, 1));
    });

    it('keeps your part of a restaurant card expense', async () => {
        await open([dinner]);

        duplicate('Dinner');

        expect(chosenPayment()).toBe(en.expenses.payment.voucher);
        expect(field(en.expenses.form.personal).value).toBe('20.00');
        expect(field(en.expenses.form.amount).value).toBe('40.00');
        expect(field(en.expenses.form.chargeDate).value).toBe(addMonths(TODAY, 1));
    });

    it('keeps the payments of a plan and the amount of each, counted from today', async () => {
        await open(sofa([700, 500, 300]));

        duplicate('Sofa');

        expect(field(en.expenses.form.amount).value).toBe('15.00');
        expect(chosenInstallments()).toBe(installmentsLabel(3));
        expect(partField(1, 3, '2026-10-25').value).toBe('7.00');
        expect(partField(2, 3, '2026-11-25').value).toBe('5.00');
        expect(partField(3, 3, '2026-12-25').value).toBe('3.00');
    });

    it('saves nothing until Add, and then a new expense with an id of its own, leaving the original alone', async () => {
        const { api } = await open([lunch]);
        duplicate('Lunch');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.attempts).toHaveLength(0);

        add();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]!.id).not.toBe(lunch.id);
        expect(api.writes[0]).toMatchObject({
            text: 'Lunch',
            categoryId: 'leisure',
            amountCents: 1250,
            currency: 'EUR',
            date: TODAY,
            createdAt: NOW,
            updatedAt: NOW,
            deletedAt: null,
            plan: null,
        });
        await waitFor(() => expect(screen.getAllByText('Lunch')).toHaveLength(2));
        expect(api.writes).toHaveLength(1);
    });

    it('saves what was changed in the form, not the original', async () => {
        const { api } = await open([lunch]);
        duplicate('Lunch');

        typeIn(en.expenses.form.amount, '9');
        typeIn(en.expenses.form.text, 'Brunch');
        add();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ text: 'Brunch', amountCents: 900, categoryId: 'leisure' });
        expect(await screen.findByText('Brunch')).toBeDefined();
        expect(screen.getByText('Lunch')).toBeDefined();
    });

    it('saves a plan as a new plan, with new ids, the same amounts and its dates counted from today', async () => {
        const original = sofa([700, 500, 300]);
        const { api } = await open(original);
        duplicate('Sofa');

        add();

        await waitFor(() => expect(api.writes).toHaveLength(3));
        const ids = original.map((part) => part.id);
        expect(api.writes.every((write) => !ids.includes(write.id))).toBe(true);
        expect(new Set(api.writes.map((write) => write.id)).size).toBe(3);
        expect(api.writes.map((write) => write.plan?.id)).toEqual(Array(3).fill(api.writes[0]!.plan!.id));
        expect(api.writes[0]!.plan!.id).not.toBe(original[0]!.plan!.id);
        expect(api.writes.map((write) => [write.plan?.part, write.plan?.parts, write.amountCents])).toEqual([
            [1, 3, 700],
            [2, 3, 500],
            [3, 3, 300],
        ]);
        expect(api.writes.map((write) => write.chargeDate)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25']);
        expect(api.writes.every((write) => write.createdAt === NOW && write.deletedAt === null)).toBe(true);
        await waitFor(() => expect(screen.getAllByText('Sofa')).toHaveLength(2));
    });

    it('goes back to adding once added, empty, with the focus on the row it was copied from', async () => {
        await open([lunch]);
        duplicate('Lunch');

        add();

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(screen.queryByRole('button', { name: en.expenses.form.cancel })).toBeNull();
        await waitFor(() => expect(screen.getAllByText('Lunch')).toHaveLength(2));
        const [added, original] = screen.getAllByText('Lunch').map((name) => name.closest('button'));
        expect(document.activeElement).toBe(original);
        expect(document.activeElement).not.toBe(added);
        expect(field(en.expenses.form.amount).value).toBe('');
        expect(field(en.expenses.form.text).value).toBe('');
    });

    it('goes back to adding on Cancel, saving nothing, with the focus on the row it was copied from', async () => {
        const { api } = await open([lunch]);
        duplicate('Lunch');
        typeIn(en.expenses.form.text, 'Brunch');

        cancel();

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(rowToggle('Lunch'));
        expect(field(en.expenses.form.text).value).toBe('');
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.attempts).toHaveLength(0);
    });

    it('replaces a new expense that was being typed, without asking', async () => {
        await open([lunch]);
        typeIn(en.expenses.form.amount, '3');
        typeIn(en.expenses.form.text, 'Half typed');
        await closeSheet();

        duplicate('Lunch');

        expect(field(en.expenses.form.amount).value).toBe('12.50');
        expect(field(en.expenses.form.text).value).toBe('Lunch');
    });

    it('starts over when it is pressed again for the same expense', async () => {
        await open([lunch]);
        duplicate('Lunch');
        typeIn(en.expenses.form.text, 'Changed');
        await closeSheet();

        fireEvent.click(duplicateButton('Lunch'));

        expect(field(en.expenses.form.text).value).toBe('Lunch');
    });

    it('takes the place of an edit, and an edit takes the place of it', async () => {
        await open([lunch, expense({ text: 'Coffee', date: '2026-10-19' })]);
        fireEvent.click(rowToggle('Coffee'));
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Coffee' }) }));
        expect(screen.getByRole('heading', { level: 2, name: en.expenses.form.editTitle })).toBeDefined();
        await closeSheet();

        duplicate('Lunch');

        expect(copySheet()).toBeDefined();
        expect(screen.queryByRole('dialog', { name: en.expenses.form.editTitle })).toBeNull();
        expect(field(en.expenses.form.text).value).toBe('Lunch');
        await closeSheet();

        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Coffee' }) }));

        expect(screen.getByRole('heading', { level: 2, name: en.expenses.form.editTitle })).toBeDefined();
        expect(screen.queryByRole('dialog', { name: en.expenses.form.copyTitle })).toBeNull();
        expect(field(en.expenses.form.text).value).toBe('Coffee');
        expect(screen.getByRole('button', { name: en.expenses.form.save })).toBeDefined();
    });

    it('drops the search, so the new row is never hidden', async () => {
        await open([lunch, expense({ text: 'Coffee', date: '2026-10-19' })]);
        fireEvent.change(screen.getByLabelText(en.expenses.filters.search), { target: { value: 'lunch' } });
        await waitFor(() => expect(screen.queryByText('Coffee')).toBeNull());
        duplicate('Lunch');

        typeIn(en.expenses.form.text, 'Brunch');
        add();

        expect(await screen.findByText('Brunch')).toBeDefined();
        expect((screen.getByLabelText(en.expenses.filters.search) as HTMLInputElement).value).toBe('');
        expect(screen.getByText('Coffee')).toBeDefined();
    });

    it('waits offline like any new expense, and is sent once the connection is back', async () => {
        const { api } = await open([lunch]);
        onlineManager.setOnline(false);
        duplicate('Lunch');

        add();

        await waitFor(() => expect(screen.getAllByText('Lunch')).toHaveLength(2));
        expect(screen.getByText(en.expenses.list.pending)).toBeDefined();
        expect(api.attempts).toHaveLength(0);
        onlineManager.setOnline(true);
        await waitFor(() => expect(api.writes).toHaveLength(1));
        await waitFor(() => expect(screen.queryByText(en.expenses.list.pending)).toBeNull());
    });

    it('keeps the currency of the original', async () => {
        const { api } = await open([expense({ text: 'Souvenir', currency: 'USD' })]);
        duplicate('Souvenir');

        add();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]!.currency).toBe('USD');
    });

    it('says so and stays on the copy when it cannot be stored on this device', async () => {
        const memory = createMemoryStorage();
        const storage = {
            ...memory,
            set: (key: string, value: unknown) =>
                key.startsWith('tarja:outbox') ? Promise.reject(new Error('quota exceeded')) : memory.set(key, value),
        };
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp({ storage });
        await screen.findByText('Lunch');
        duplicate('Lunch');

        add();

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.saveFailed);
        expect(copySheet()).toBeDefined();
        expect(field(en.expenses.form.text).value).toBe('Lunch');
        expect(screen.getAllByText('Lunch')).toHaveLength(1);
    });
});

describe('duplicating in Spanish', () => {
    const tEs = createTranslator({ locale: 'es', messages: es });

    beforeEach(() => localStorage.setItem('tarja:locale', 'es'));
    afterEach(() => localStorage.clear());

    it('speaks Spanish', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: 'Cena' })] }).handler);
        renderApp();
        await screen.findByText('Cena');

        fireEvent.click(rowToggle('Cena'));
        expect(
            screen.getByRole('button', { name: tEs('expenses.list.duplicateItem', { name: 'Cena' }) })
        ).toBeDefined();
        expect(screen.getByText(es.expenses.list.duplicate)).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: tEs('expenses.list.duplicateItem', { name: 'Cena' }) }));

        expect(screen.getByRole('heading', { level: 2, name: es.expenses.form.copyTitle })).toBeDefined();
        expect(screen.getByRole('button', { name: es.expenses.form.submit })).toBeDefined();
    });
});
