import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { expect } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { EXPENSES_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { renderApp, stubApi } from '@/lib/testing/render-app';

import type { Expense } from '@core/expenses/expense';

const text = en.charts;

const t = createTranslator({ locale: 'en', messages: en });

const tEs = createTranslator({ locale: 'es', messages: es });

const weekOf = (date: string) => t('charts.weekOf', { date });

const expense = (overrides: Partial<Expense> = {}): Expense => {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1000,
        currency: 'EUR',
        date: '2026-10-24',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
};

const EXPENSES = [
    expense({ amountCents: 1250 }),
    expense({ categoryId: 'groceries', amountCents: 4599, date: '2026-10-25' }),
    expense({ amountCents: 300, date: '2026-10-25' }),
    expense({ categoryId: 'leisure', amountCents: 2000, date: '2026-10-10' }),
    expense({ amountCents: 700, date: '2026-09-30' }),
    expense({
        categoryId: 'leisure',
        amountCents: 800,
        date: '2026-09-20',
        payment: 'credit',
        chargeDate: '2026-10-02',
    }),
    expense({ amountCents: 99_900, deletedAt: 5_000 }),
];

const open = async (expenses: Expense[] = EXPENSES, options: Parameters<typeof createFakeApi>[0] = {}) => {
    stubApi(createFakeApi({ expenses, ...options }).handler);
    const app = renderApp({ path: '/charts' });
    await screen.findByRole('heading', { name: text.title });
    await waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
    return app;
};

const table = () => {
    const toggle = screen.getByRole('button', { name: text.showNumbers });
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
    return screen.getByRole('table', { name: text.spendingTitle });
};

const rows = () => {
    return within(table()).getAllByRole('row').slice(1);
};

const rowOf = (label: string | RegExp) => {
    const found = rows().find((item) =>
        typeof label === 'string' ? item.textContent?.includes(label) : label.test(item.textContent ?? '')
    );
    if (!found) throw new Error(`No row for ${String(label)}`);
    return found;
};

const chart = () => {
    return document.querySelector<SVGSVGElement>('svg[role="group"]');
};

const plot = () => {
    const found = chart();
    if (!found) throw new Error('No chart');
    return found;
};

const columns = () => {
    return [...plot().querySelectorAll<SVGRectElement>('.spending-chart__column')];
};

const slots = () => {
    return [...plot().querySelectorAll<SVGRectElement>('.spending-chart__slot')];
};

const shareOf = (element: Element) => {
    return Number((element as SVGElement).style.getPropertyValue('--share'));
};

const readout = () => {
    return document.getElementById(plot().getAttribute('aria-describedby')!)!;
};

const totalLine = () => {
    return document.querySelector('.spending-stats__total')!;
};

const changeLine = () => {
    return totalLine().nextElementSibling!;
};

const period = (from: Date, to: Date, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => {
    return new Intl.DateTimeFormat('en', options).formatRange(from, to);
};

const percent = (share: number) =>
    new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(
        share
    );

const breakdown = () => {
    return within(screen.getByRole('list', { name: text.byCategory })).getAllByRole('listitem');
};

const splitRow = (name: string) => {
    return within(screen.getByRole('list', { name: text.byCategory })).getByRole('button', {
        name: new RegExp(`^${name}`),
    });
};

const pick = (name: string) => {
    fireEvent.click(splitRow(name));
};

const groupBy = (label: string) => {
    fireEvent.click(screen.getByRole('radio', { name: label }));
};

const dates = (from: string, to: string) => {
    fireEvent.change(screen.getByLabelText(text.from), { target: { value: from } });
    fireEvent.change(screen.getByLabelText(text.to), { target: { value: to } });
};

export {
    breakdown,
    changeLine,
    chart,
    columns,
    dates,
    expense,
    EXPENSES,
    groupBy,
    open,
    percent,
    period,
    pick,
    plot,
    readout,
    rowOf,
    rows,
    shareOf,
    slots,
    splitRow,
    t,
    table,
    tEs,
    text,
    totalLine,
    weekOf,
};
