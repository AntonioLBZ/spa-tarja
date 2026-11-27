import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import {
    cafe,
    clear,
    closeFilters,
    f,
    filtersToggle,
    list,
    noMatch,
    open,
    openFilters,
    pickGrouping,
    root,
    rowNames,
    search,
    searchBox,
    shop,
    showing,
    sofa,
} from '@/lib/testing/expense-list';
import { deleteExpense, expense, field, fillAndSubmit, rowToggle, t } from '@/lib/testing/expenses';
import { chosenOption, pickOption } from '@/lib/testing/select';
import { ensureAddSheet } from '@/lib/testing/sheet';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    localStorage.clear();
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    root.style.removeProperty('--duration-base');
});

describe('the filters', () => {
    it('keep one category', async () => {
        await open(list);
        openFilters();

        pickOption(f.category, en.categories.groceries);

        expect(rowNames()).toEqual(['Weekly shop']);
        expect(filtersToggle(1)).toBeDefined();
        expect(showing(1, 4)).not.toBeNull();
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

    it('keep the plans as installments, and what was paid at once as now', async () => {
        await open([
            ...sofa(),
            expense({ text: 'Lunch' }),
            expense({ text: 'Shoes', payment: 'credit', chargeDate: '2026-11-05' }),
            expense({ text: 'Dinner', payment: 'voucher', chargeDate: '2026-11-05' }),
        ]);
        openFilters();

        pickOption(f.paidWith, f.paid.plan);
        expect(rowNames()).toEqual(['Sofa']);

        pickOption(f.paidWith, en.expenses.payment.direct);
        expect(rowNames()).toEqual(['Lunch']);

        pickOption(f.paidWith, en.expenses.payment.credit);
        expect(rowNames()).toEqual(['Shoes']);

        pickOption(f.paidWith, en.expenses.payment.voucher);
        expect(rowNames()).toEqual(['Dinner']);
        expect(filtersToggle(1)).toBeDefined();

        pickOption(f.paidWith, f.paid.any);
        expect(rowNames()).toHaveLength(4);
    });

    it('combine with each other and with the search', async () => {
        await open(list);
        openFilters();

        pickOption(f.category, en.categories.groceries);
        fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-10-10' } });
        expect(filtersToggle(2)).toBeDefined();
        expect(rowNames()).toEqual(['Weekly shop']);

        search('cafe');
        expect(rowNames()).toEqual([]);
        expect(noMatch()).not.toBeNull();
    });

    it('are all dropped by Clear, which leaves the grouping alone', async () => {
        await open(list);
        pickGrouping(f.group.week);
        search('shop');
        openFilters();
        pickOption(f.category, en.categories.groceries);
        fireEvent.change(screen.getByLabelText(f.from), { target: { value: '2026-10-01' } });
        pickOption(f.paidWith, en.expenses.payment.direct);

        clear();

        expect(rowNames()).toHaveLength(4);
        expect(searchBox().value).toBe('');
        expect(filtersToggle(0)).toBeDefined();
        openFilters();
        expect(chosenOption(f.category)).toBe(f.allCategories);
        expect((screen.getByLabelText(f.from) as HTMLInputElement).value).toBe('');
        expect(chosenOption(f.paidWith)).toBe(f.paid.any);
        expect(chosenOption(f.groupBy)).toBe(f.group.week);
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
        expect(rowNames()).toHaveLength(3);
    });
});

describe('the dates', () => {
    const dates = () => [
        (screen.getByLabelText(f.from) as HTMLInputElement).value,
        (screen.getByLabelText(f.to) as HTMLInputElement).value,
    ];

    const changeDate = (label: string, value: string) => {
        openFilters();
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
        closeFilters();
    };

    const addOn = async (text: string, day?: string) => {
        if (day) fireEvent.change(field(en.expenses.form.date), { target: { value: day } });
        fillAndSubmit({ amount: '3', text });
        await screen.findByText(text);
    };

    it('open on the first of this month with no end, which is not a filter in use', async () => {
        await open(list);

        expect(rowNames()).toEqual(['Weekly shop', 'Café con leche', 'Cinema']);
        expect(showing(3, 4)).toBeNull();
        expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
        expect(filtersToggle(0)).toBeDefined();
        expect(dates()).toEqual(['2026-10-01', '']);
    });

    it('count as a filter in use once they are not those the list opened on', async () => {
        await open(list);

        changeDate(f.from, '2026-09-01');

        expect(rowNames()).toHaveLength(4);
        expect(filtersToggle(1)).toBeDefined();
        expect(showing(4, 4)).not.toBeNull();

        changeDate(f.from, '2026-10-01');

        expect(filtersToggle(0)).toBeDefined();
        expect(showing(3, 4)).toBeNull();
    });

    it('are emptied by Clear, which shows every expense', async () => {
        await open(list);
        changeDate(f.from, '2026-10-20');
        expect(rowNames()).toHaveLength(2);

        clear();

        expect(rowNames()).toHaveLength(4);
        expect(filtersToggle(0)).toBeDefined();
        expect(dates()).toEqual(['', '']);
        expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
    });

    it('go back to the first of this month when an expense of this month is added', async () => {
        await open(list);
        changeDate(f.from, '2026-10-20');

        await addOn('Tea', '2026-10-12');

        expect(dates()).toEqual(['2026-10-01', '']);
        expect(rowNames()).toContain('Tea');
        expect(filtersToggle(0)).toBeDefined();
    });

    it('move to the whole month of an expense added to an earlier one', async () => {
        await open(list);

        await addOn('Tea', '2026-08-15');

        expect(dates()).toEqual(['2026-08-01', '2026-08-31']);
        expect(rowNames()).toEqual(['Tea']);
        expect(filtersToggle(1)).toBeDefined();
    });

    it('are as they were on opening once the screen is left and come back to', async () => {
        await open(list);
        changeDate(f.from, '');
        expect(rowNames()).toHaveLength(4);

        fireEvent.click(screen.getByRole('link', { name: en.nav.summary }));
        await screen.findByRole('heading', { name: en.summary.title });
        fireEvent.click(screen.getByRole('link', { name: en.nav.expenses }));

        await screen.findByText('Cinema');
        expect(rowNames()).toEqual(['Weekly shop', 'Café con leche', 'Cinema']);
        expect(dates()).toEqual(['2026-10-01', '']);
    });
});

describe('a filter that would hide a new expense', () => {
    it('is dropped by adding an expense, so the new row shows, and the grouping stays', async () => {
        const { api } = await open([cafe, shop]);
        pickGrouping(f.group.week);
        openFilters();
        pickOption(f.category, en.categories.food);
        search('cafe');
        expect(rowNames()).toEqual(['Café con leche']);

        fillAndSubmit({ amount: '2', text: 'Beers' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        await waitFor(() => expect(rowNames()).toContain('Beers'));
        expect(rowNames()).toHaveLength(3);
        expect(searchBox().value).toBe('');
        expect(filtersToggle(0)).toBeDefined();
        expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
        openFilters();
        expect(chosenOption(f.category)).toBe(f.allCategories);
        expect(chosenOption(f.groupBy)).toBe(f.group.week);
        expect(localStorage.getItem('tarja:list-grouping')).toBe('week');
    });

    it('is not dropped when the form refuses the expense', async () => {
        const { api } = await open([cafe, shop]);
        search('cafe');
        ensureAddSheet();

        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));

        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.writes).toHaveLength(0);
        expect(searchBox().value).toBe('cafe');
    });

    it('is not dropped by the edit of an expense', async () => {
        await open([cafe, shop]);
        search('cafe');
        fireEvent.click(rowToggle('Café con leche'));
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Café con leche' }) }));

        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

        await waitFor(() => expect(document.activeElement).toBe(rowToggle('Café con leche')));
        expect(searchBox().value).toBe('cafe');
    });

    it('is dropped once no expense is left, so the next one that arrives is not hidden', async () => {
        root.style.setProperty('--duration-base', '0ms');
        const { app } = await open([cafe]);
        search('cafe');
        openFilters();
        pickOption(f.category, en.categories.food);
        closeFilters();

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

        await waitFor(() => expect(noMatch()).not.toBeNull());
        expect(searchBox().value).toBe('shop');
    });
});
