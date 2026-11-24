import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { Expense } from '@core/expense';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.settings.print;

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-11-10',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

function plan(parts: number, cents: number): Expense[] {
    const id = crypto.randomUUID();
    return Array.from({ length: parts }, (_, index) =>
        expense({
            text: 'Laptop',
            categoryId: 'other',
            amountCents: cents,
            date: '2026-11-03',
            chargeDate: `2026-${String(11 + index).padStart(2, '0')}-03`,
            plan: { id, part: index + 1, parts },
        })
    );
}

async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
    stubApi(createFakeApi(options).handler);
    renderApp({ path: '/settings/account/print' });
    await screen.findByRole('heading', { level: 1, name: text.title });
}

function rowTexts() {
    return within(screen.getByRole('table'))
        .getAllByRole('row')
        .map((row) => [...row.children].map((cell) => cell.textContent));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 24, 12));
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
});

describe('the way to the printable view', () => {
    it('is a link in Your data, after the two files', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings/account' });

        const link = await screen.findByRole('link', { name: en.settings.data.print });
        expect(link.getAttribute('href')).toBe('/settings/account/print');
        expect(link.previousElementSibling?.textContent).toBe(en.settings.data.csv);
    });
});

describe('the printable view of the expenses', () => {
    it('opens on the month of the list, oldest first, with what the list adds up', async () => {
        await open({
            expenses: [
                expense({ text: 'Dinner', date: '2026-11-20', amountCents: 3000 }),
                expense({ text: 'Lunch', date: '2026-11-10' }),
                expense({ text: 'October', date: '2026-10-30' }),
            ],
        });

        await waitFor(() => expect(screen.getByRole('table')).toBeDefined());
        expect(rowTexts().slice(1)).toEqual([
            ['Nov 10, 2026', 'Lunch', 'Food', en.expenses.payment.direct, '', '€12.50'],
            ['Nov 20, 2026', 'Dinner', 'Food', en.expenses.payment.direct, '', '€30.00'],
            [text.total, '€42.50'],
        ]);
        expect(screen.getByText(t('settings.print.range.from', { from: 'Nov 1, 2026' }))).toBeDefined();
    });

    it('keeps a plan as one row at its full price and a shared expense at your part, with its group', async () => {
        const group = sampleGroup({ name: 'Flat' });
        await open({
            expenses: plan(3, 30000),
            groups: [group],
            entries: [sampleEntry(group, { date: '2026-11-12', text: 'Pizza' })],
        });

        await waitFor(() => expect(rowTexts()).toHaveLength(4));
        expect(rowTexts().slice(1)).toEqual([
            ['Nov 3, 2026', 'Laptop', 'Other', t('settings.print.plan', { parts: 3 }), '', '€900.00'],
            ['Nov 12, 2026', 'Pizza', 'Food', en.expenses.payment.direct, 'Flat', '€20.00'],
            [text.total, '€920.00'],
        ]);
    });

    it('filters with the sheet of the list, with no grouping, and says the filter in the caption', async () => {
        await open({ expenses: [expense({ text: 'Lunch' }), expense({ text: 'Cinema', categoryId: 'leisure' })] });
        await waitFor(() => expect(screen.getByRole('table')).toBeDefined());

        fireEvent.click(screen.getByRole('button', { name: t('expenses.filters.toggle', { count: 0 }) }));
        expect(screen.queryByLabelText(en.expenses.filters.groupBy)).toBeNull();
        fireEvent.change(screen.getByLabelText(en.expenses.filters.category), { target: { value: 'leisure' } });

        expect(rowTexts().slice(1)).toEqual([
            ['Nov 10, 2026', 'Cinema', 'Leisure', en.expenses.payment.direct, '', '€12.50'],
            [text.total, '€12.50'],
        ]);
        expect(screen.getByText(`${t('settings.print.range.from', { from: 'Nov 1, 2026' })} · Leisure`)).toBeDefined();
    });

    it('names how it was paid on each row and in the caption when it filters by it', async () => {
        await open({
            expenses: [
                expense({ text: 'Lunch' }),
                expense({ text: 'Shoes', payment: 'credit', chargeDate: '2026-12-01', amountCents: 6000 }),
            ],
        });
        await waitFor(() => expect(screen.getByRole('table')).toBeDefined());

        fireEvent.click(screen.getByRole('button', { name: t('expenses.filters.toggle', { count: 0 }) }));
        fireEvent.change(screen.getByLabelText(en.expenses.filters.paidWith), { target: { value: 'credit' } });

        expect(rowTexts()[1]).toEqual(['Nov 10, 2026', 'Shoes', 'Food', en.expenses.payment.credit, '', '€60.00']);
        expect(
            screen.getByText(`${t('settings.print.range.from', { from: 'Nov 1, 2026' })} · ${text.paid.credit}`)
        ).toBeDefined();
    });

    it('drops every filter on Clear, the month it opened on too', async () => {
        await open({ expenses: [expense({ text: 'Lunch' }), expense({ text: 'October', date: '2026-10-30' })] });
        await waitFor(() => expect(screen.getByRole('table')).toBeDefined());

        fireEvent.change(screen.getByLabelText(en.expenses.filters.search), { target: { value: 'lunch' } });
        fireEvent.click(await screen.findByRole('button', { name: en.expenses.filters.clear }));

        await waitFor(() => expect(rowTexts()).toHaveLength(4));
        expect(
            rowTexts()
                .slice(1, 3)
                .map((row) => row[1])
        ).toEqual(['October', 'Lunch']);
        expect(screen.getByText(text.range.all)).toBeDefined();
    });

    it('says once that a filter leaves nothing', async () => {
        await open({ expenses: [expense()] });
        await waitFor(() => expect(screen.getByRole('table')).toBeDefined());

        fireEvent.change(screen.getByLabelText(en.expenses.filters.search), { target: { value: 'nothing like it' } });

        await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
        const said = screen.getAllByText(en.expenses.list.noMatch);
        expect(said.every((element) => element.closest('.filter-status') !== null)).toBe(true);
    });

    it('says when the expenses of a group are left out of the table', async () => {
        const group = sampleGroup();
        const api = createFakeApi({ expenses: [expense()], groups: [group] });
        stubApi((url, init) =>
            url.pathname.endsWith('/entries') ? new Response(null, { status: 503 }) : api.handler(url, init)
        );
        renderApp({ path: '/settings/account/print' });

        expect(await screen.findByText(text.missing)).toBeDefined();
    });

    it('says when nothing is left, with Print off', async () => {
        await open({ expenses: [expense({ date: '2026-10-01' })] });

        expect(await screen.findByText(en.expenses.list.noMatch)).toBeDefined();
        expect(screen.queryByRole('table')).toBeNull();
        expect((screen.getByRole('button', { name: text.print }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('prints the page with the browser', async () => {
        const print = vi.fn();
        vi.stubGlobal('print', print);
        await open({ expenses: [expense()] });
        await waitFor(() => expect(screen.getByRole('table')).toBeDefined());

        fireEvent.click(screen.getByRole('button', { name: text.print }));

        expect(print).toHaveBeenCalledOnce();
    });
});
