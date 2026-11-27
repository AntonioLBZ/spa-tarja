import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { expect } from 'vitest';

import en from '@/assets/locales/en.json';
import { CATEGORIES_KEY } from '@/lib/api';
import { optionNames, chosenOption, pickOption } from '@/lib/testing/select';
import { ensureAddSheet } from '@/lib/testing/sheet';
import { type Expense, type Payment } from '@core/expenses/expense';

const TODAY = '2026-10-25';

const t = createTranslator({ locale: 'en', messages: en });

const pickPayment = (kind: Payment) => pickOption(en.expenses.form.payment, en.expenses.payment[kind]);

const chosenPayment = () => chosenOption(en.expenses.form.payment);

const installmentsLabel = (count: number) => t('expenses.form.installmentsOption', { count });

const pickInstallments = (count: number) => pickOption(en.expenses.form.installments, installmentsLabel(count));

const chosenInstallments = () => chosenOption(en.expenses.form.installments);

const expense = (overrides: Partial<Expense> = {}): Expense => {
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
};

const shown = (isoDay: string) => {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(`${isoDay}T12:00:00`)
    );
};

const field = (label: string) => {
    ensureAddSheet();
    return screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement;
};

// Polling must not touch the page, which is what reading the options of the select does
const categoriesLoaded = (app: {
    queryClient: { getQueryState: (key: readonly string[]) => { status: string } | undefined };
}) => {
    return waitFor(() => expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success'));
};

const categoryLabels = () => {
    return optionNames(en.expenses.form.category);
};

const fillAndSubmit = ({ amount, text }: { amount: string; text: string }) => {
    fireEvent.change(field(en.expenses.form.amount), { target: { value: amount } });
    fireEvent.change(field(en.expenses.form.text), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));
};

const rowToggle = (name: string) => {
    return screen.getByText(name, { selector: '.expense-item__text' }).closest('button')!;
};

const deleteButton = (name: string) => {
    return screen.getByRole('button', { name: t('expenses.list.deleteItem', { name }) }) as HTMLButtonElement;
};

const deleteExpense = (name: string) => {
    fireEvent.click(rowToggle(name));
    fireEvent.click(deleteButton(name));
};

const lookOf = (element: HTMLElement) => {
    const icon = element.querySelector('[data-icon]')?.getAttribute('data-icon') ?? null;
    const color = /category-badge--(\w+)/.exec(element.querySelector('.category-badge')?.className ?? '')?.[1] ?? null;
    return { icon, color };
};

export {
    categoriesLoaded,
    categoryLabels,
    chosenInstallments,
    chosenPayment,
    deleteButton,
    deleteExpense,
    expense,
    field,
    fillAndSubmit,
    installmentsLabel,
    lookOf,
    pickInstallments,
    pickPayment,
    rowToggle,
    shown,
    t,
    TODAY,
};
