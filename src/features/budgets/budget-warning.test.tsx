import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { BUDGETS_KEY, EXPENSES_KEY, INCOME_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { Budget } from '@core/budget';
import type { Expense } from '@core/expense';

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

function limit(month: string, scope: string, amountCents: number): Budget {
    return { month, scope, amountCents, currency: 'EUR' };
}

async function open(options: Parameters<typeof createFakeApi>[0] = {}, path = '/') {
    const api = createFakeApi(options);
    stubApi(api.handler);
    const app = renderApp({ path });
    await screen.findByRole('heading', { name: en.expenses.form.title });
    await waitFor(() => {
        expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(BUDGETS_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(INCOME_KEY)?.status).toBe('success');
    });
    return { api, app };
}

function field(label: string) {
    return screen.getByLabelText(label) as HTMLInputElement;
}

function add(amount: string, date?: string) {
    fireEvent.change(field(en.expenses.form.amount), { target: { value: amount } });
    fireEvent.change(field(en.expenses.form.text), { target: { value: 'lunch' } });
    if (date) fireEvent.change(field(en.expenses.form.date), { target: { value: date } });
    fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));
}

function toastText() {
    return document.querySelector('.toast-region')?.textContent ?? '';
}

async function formCleared() {
    await waitFor(() => expect(field(en.expenses.form.amount).value).toBe(''));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('the warning after adding an expense', () => {
    const food = [limit('2026-10', 'food', 10_000)];

    it('says a limit is near when the expense takes it to 80 % or more', async () => {
        await open({ expenses: [expense({ amountCents: 7_000 })], budgets: food });

        add('20');

        await waitFor(() => expect(toastText()).toBe('Food of October is at 90 % of its limit'));
    });

    it('says a limit was passed', async () => {
        await open({ expenses: [expense({ amountCents: 9_000 })], budgets: food });

        add('20');

        await waitFor(() => expect(toastText()).toBe('Food of October went over its limit'));
    });

    it('says it of the total', async () => {
        await open({
            expenses: [expense({ amountCents: 4_000, categoryId: 'leisure' })],
            budgets: [limit('2026-10', 'total', 10_000)],
        });

        add('70');

        await waitFor(() => expect(toastText()).toBe('The total of October went over its limit'));
    });

    it('says the leftover falls below zero when the month has an income', async () => {
        await open({
            expenses: [expense({ amountCents: 6_000 })],
            income: [{ month: '2026-10', amountCents: 10_000, currency: 'EUR' }],
        });

        add('50');

        await waitFor(() => expect(toastText()).toBe('This leaves October below zero'));
    });

    it('names the month the expense counts in, and the year when it is not this one', async () => {
        await open({
            expenses: [expense({ amountCents: 9_000, date: '2027-01-02' })],
            budgets: [limit('2026-10', 'total', 10_000)],
        });

        add('20', '2027-01-06');

        await waitFor(() => expect(toastText()).toBe('The total of January 2027 went over its limit'));
    });

    it('says nothing when the expense crosses nothing', async () => {
        await open({ expenses: [expense({ amountCents: 1_000 })], budgets: food });

        add('10');

        await formCleared();
        expect(toastText()).toBe('');
    });

    it('says nothing without a limit and without an income', async () => {
        await open({ expenses: [expense({ amountCents: 9_000 })] });

        add('900');

        await formCleared();
        expect(toastText()).toBe('');
    });

    it('does not say it again for a limit that was already passed', async () => {
        await open({ expenses: [expense({ amountCents: 11_000 })], budgets: food });

        add('20');

        await formCleared();
        expect(toastText()).toBe('');
    });

    it('says nothing when an expense is edited past a limit', async () => {
        await open({ expenses: [expense({ amountCents: 7_000 })], budgets: food });
        fireEvent.click(screen.getByText('Lunch').closest('button')!);
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Lunch' }) }));

        fireEvent.change(field(en.expenses.form.amount), { target: { value: '95' } });
        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

        await waitFor(() => expect(screen.queryByRole('heading', { name: en.expenses.form.editTitle })).toBeNull());
        expect(toastText()).toBe('');
    });

    it('says it when an expense is duplicated past a limit', async () => {
        await open({ expenses: [expense({ amountCents: 7_000 })], budgets: food });
        fireEvent.click(screen.getByText('Lunch').closest('button')!);
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.duplicateItem', { name: 'Lunch' }) }));

        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));

        await waitFor(() => expect(toastText()).toBe('Food of October went over its limit'));
    });

    it('is in the language of the app', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const api = createFakeApi({ expenses: [expense({ amountCents: 9_000 })], budgets: food });
        stubApi(api.handler);
        renderApp({ path: '/' });
        fireEvent.change(await screen.findByLabelText(es.expenses.form.amount), { target: { value: '20' } });
        fireEvent.change(screen.getByLabelText(es.expenses.form.text), { target: { value: 'almuerzo' } });
        fireEvent.click(screen.getByRole('button', { name: es.expenses.form.submit }));

        await waitFor(() => expect(toastText()).toBe('Comida de octubre ha superado su límite'));
        localStorage.clear();
    });
});
