import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import {
    cafe,
    clear,
    f,
    filtersSheet,
    filtersToggle,
    list,
    longDay,
    noMatch,
    open,
    openFilters,
    pickGrouping,
    root,
    rowNames,
    search,
    searchBox,
    showing,
    statusRegion,
} from '@/lib/testing/expense-list';
import { field, t } from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { optionNames, chosenOption, pickOption } from '@/lib/testing/select';
import { closeSheet, ensureAddSheet } from '@/lib/testing/sheet';

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

describe('the controls', () => {
    it('are not there while there are no expenses', async () => {
        stubApi(createFakeApi().handler);

        renderApp();

        await screen.findByText(en.expenses.list.empty);
        expect(screen.queryByRole('searchbox')).toBeNull();
        expect(screen.queryByRole('button', { name: /^Filters/ })).toBeNull();
    });

    it('start with the search and the Filters button beside it, the sheet closed', async () => {
        await open(list);

        expect(searchBox().type).toBe('search');
        expect(filtersToggle(0).getAttribute('aria-haspopup')).toBe('dialog');
        expect(filtersToggle(0).querySelector('.button__badge')).toBeNull();
        expect(filtersSheet().open).toBe(false);
        expect(screen.queryByRole('combobox', { name: f.groupBy })).toBeNull();
        expect(showing(3, 4)).toBeNull();
        expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
    });

    it('open a sheet with the grouping, the category, the dates and how it was paid', async () => {
        await open(list);

        fireEvent.click(filtersToggle());

        const sheet = within(filtersSheet());
        expect(filtersSheet().open).toBe(true);
        expect(
            sheet.getAllByRole('combobox').map((one) => document.querySelector(`label[for="${one.id}"]`)?.textContent)
        ).toEqual([f.groupBy, f.category, f.paidWith, f.sharedWith]);
        expect(optionNames(f.groupBy)).toEqual([f.group.day, f.group.week, f.group.month, f.group.category]);
        expect(chosenOption(f.category)).toBe(f.allCategories);
        expect((sheet.getByLabelText(f.from) as HTMLInputElement).value).toBe('2026-10-01');
        expect((sheet.getByLabelText(f.to) as HTMLInputElement).value).toBe('');
        expect(chosenOption(f.groupBy)).toBe(f.group.day);
        expect(chosenOption(f.paidWith)).toBe(f.paid.any);
        expect((sheet.getByRole('button', { name: f.clearFilters }) as HTMLButtonElement).disabled).toBe(true);
        expect(sheet.getAllByRole('button').map((button) => button.textContent)).toEqual([f.clearFilters, f.close]);
    });

    it('show the number of filters on in the corner of the button, and say in the sheet how many rows are left', async () => {
        await open(list);
        openFilters();

        pickOption(f.category, en.categories.groceries);

        expect(filtersToggle(1).querySelector('.button__badge')!.textContent).toBe('1');
        expect(
            within(filtersSheet()).getByText(t('expenses.filters.showing', { shown: 1, total: 4 }), {
                selector: 'p',
            })
        ).toBeDefined();
    });

    it('drop the filters of the sheet with Clear filters, keeping the search and the grouping', async () => {
        await open(list);
        pickGrouping(f.group.week);
        search('shop');
        openFilters();
        pickOption(f.category, en.categories.groceries);
        pickOption(f.paidWith, en.expenses.payment.direct);

        fireEvent.click(within(filtersSheet()).getByRole('button', { name: f.clearFilters }));

        expect(filtersToggle(0)).toBeDefined();
        expect(chosenOption(f.category)).toBe(f.allCategories);
        expect(chosenOption(f.paidWith)).toBe(f.paid.any);
        expect((screen.getByLabelText(f.from) as HTMLInputElement).value).toBe('');
        expect(chosenOption(f.groupBy)).toBe(f.group.week);
        expect(searchBox().value).toBe('shop');
        expect(filtersSheet().open).toBe(true);
    });

    it('name how it was paid like the form does', async () => {
        await open(list);
        fireEvent.click(filtersToggle());

        expect(optionNames(f.paidWith)).toEqual([
            f.paid.any,
            en.expenses.payment.direct,
            en.expenses.payment.credit,
            en.expenses.payment.voucher,
            f.paid.plan,
        ]);
    });

    it('draw an icon before every option of the lists of the sheet, the ones that narrow nothing too', async () => {
        await open(list);
        fireEvent.click(filtersToggle());

        const options = within(filtersSheet()).getAllByRole('option');

        expect(options.length).toBeGreaterThan(0);
        expect(options.filter((option) => !option.querySelector('svg')).map((option) => option.textContent)).toEqual(
            []
        );
        const iconOf = (label: string, name: string) =>
            within(screen.getByRole('combobox', { name: label }))
                .getByRole('option', { name })
                .querySelector('[data-icon]')
                ?.getAttribute('data-icon');
        expect(iconOf(f.category, f.allCategories)).toBe('apps');
        expect(iconOf(f.paidWith, f.paid.any)).toBe('wallet');
        expect(iconOf(f.sharedWith, f.shared.anyone)).toBe('groups');
        expect(iconOf(f.sharedWith, f.shared.me)).toBe('account_circle');
        expect(iconOf(f.groupBy, f.group.week)).toBe('date_range');
        expect(iconOf(f.paidWith, f.paid.plan)).toBe('event_repeat');
    });

    it('offer who it is shared with after how it was paid: anyone, just you, then each group and friend in your expenses', async () => {
        const me = person('Ana', { role: 'owner' });
        const friend = sampleGroup({ kind: 'direct', name: null, members: [me, person('Bea')], me: me.id });
        const trip = sampleGroup({ name: 'Trip', members: [me, person('Cris')], me: me.id });
        const hidden = sampleGroup({
            name: 'Work',
            members: [me, person('Dani')],
            me: me.id,
            showInExpenses: false,
        });
        const closed = sampleGroup({ name: 'Rome', members: [me, person('Eva')], me: me.id, closed: 'deleted' });
        stubApi(createFakeApi({ expenses: list, groups: [friend, trip, hidden, closed] }).handler);
        const app = renderApp();
        await screen.findByText(cafe.text);
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
        fireEvent.click(filtersToggle());

        const sharedWith = screen.getByRole('combobox', { name: f.sharedWith });
        const paidWith = screen.getByRole('combobox', { name: f.paidWith });
        expect(paidWith.compareDocumentPosition(sharedWith) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(chosenOption(f.sharedWith)).toBe(f.shared.anyone);
        expect(optionNames(f.sharedWith)).toEqual([f.shared.anyone, f.shared.me, 'Trip', 'Rome', 'Bea']);
    });

    it('count who it is shared with as a filter, and find no shared row of a group yet', async () => {
        const me = person('Ana', { role: 'owner' });
        const trip = sampleGroup({ name: 'Trip', members: [me, person('Cris')], me: me.id });
        stubApi(createFakeApi({ expenses: list, groups: [trip] }).handler);
        const app = renderApp();
        await screen.findByText(cafe.text);
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
        fireEvent.click(filtersToggle());

        pickOption(f.sharedWith, f.shared.me);
        expect(filtersToggle(1)).toBeDefined();
        expect(rowNames()).toEqual(['Weekly shop', 'Café con leche', 'Cinema']);

        pickOption(f.sharedWith, 'Trip');
        await waitFor(() => expect(noMatch()).not.toBeNull());

        clear();
        expect(filtersToggle(0)).toBeDefined();
        openFilters();
        expect(chosenOption(f.sharedWith)).toBe(f.shared.anyone);
    });

    it('close with Close and give the focus back to the button', async () => {
        await open(list);
        filtersToggle().focus();
        fireEvent.click(filtersToggle());

        fireEvent.click(within(filtersSheet()).getByRole('button', { name: f.close }));

        expect(filtersSheet().open).toBe(false);
        expect(document.activeElement).toBe(filtersToggle());
    });

    it('close with a tap outside the sheet', async () => {
        await open(list);
        fireEvent.click(filtersToggle());

        fireEvent.pointerDown(filtersSheet(), { clientX: -10, clientY: -10 });
        fireEvent.click(filtersSheet(), { clientX: -10, clientY: -10 });

        expect(filtersSheet().open).toBe(false);
    });

    it('do not clash with the add form, which keeps its own category field and date', async () => {
        await open(list);
        ensureAddSheet();
        const addCategory = screen.getByRole('combobox', { name: en.expenses.form.category });
        const addDate = field(en.expenses.form.date);
        await closeSheet();
        openFilters();

        expect(screen.getByRole('combobox', { name: f.category })).not.toBe(addCategory);
        expect(screen.getByLabelText(f.from)).not.toBe(addDate);
    });
});

describe('the focus', () => {
    it('goes to the filters button when Clear is pressed, never to the search field', async () => {
        await open(list);
        search('shop');

        clear();

        expect(document.activeElement).toBe(filtersToggle());
        expect(document.activeElement).not.toBe(searchBox());
    });

    it('goes to the filters button when Clear is pressed in the empty result too', async () => {
        await open(list);
        search('nothing like this');

        clear();

        expect(document.activeElement).toBe(filtersToggle());
        expect(rowNames()).toHaveLength(4);
    });

    it('has a status region that is already there before the count, and fills it', async () => {
        await open(list);
        const region = statusRegion()!;
        expect(region).not.toBeNull();
        expect(region.textContent).toBe('');

        search('shop');

        expect(statusRegion()).toBe(region);
        await waitFor(() => expect(region.textContent).toBe(t('expenses.filters.showing', { shown: 1, total: 4 })), {
            timeout: 2_000,
        });

        clear();

        expect(statusRegion()).toBe(region);
        expect(region.textContent).toBe('');
    });

    it('reads the count out only once the typing pauses, though it shows at once', async () => {
        await open(list);
        const region = statusRegion();

        search('s');
        search('sh');
        search('shop');

        expect(showing(1, 4)).not.toBeNull();
        expect(region.textContent).toBe('');
        await waitFor(() => expect(region.textContent).toBe(t('expenses.filters.showing', { shown: 1, total: 4 })), {
            timeout: 2_000,
        });
    });

    it('keeps the empty status region out of the layout of the controls', async () => {
        await open(list);

        const line = () => statusRegion().closest('.expense-list-controls > .filter-status')!;
        expect(line().className).toContain('filter-status--idle');

        search('shop');

        expect(line().className).not.toContain('filter-status--idle');
    });
});

describe('the group labels', () => {
    it('are plain text for a date, which keeps its capital letter, and a row of icon and name for a category', async () => {
        await open(list);
        const heading = () => screen.getAllByRole('heading', { level: 2 })[0]!;

        expect(heading().className).toContain('expense-list__label--date');
        expect(heading().className).not.toContain('expense-list__label--category');

        pickGrouping(f.group.category);

        expect(heading().className).toContain('expense-list__label--category');
        expect(heading().className).not.toContain('expense-list__label--date');
    });

    it('end with a line that says Total in visible text, under the rows', async () => {
        await open(list);

        const group = screen.getByRole('heading', { level: 2, name: longDay('2026-10-24') }).closest('section')!;
        const total = group.querySelector('.expense-list__total')!;

        expect(total.textContent).toBe(`${en.expenses.list.total} €48.00`);
        expect(total.querySelector('.visually-hidden')).toBeNull();
        expect(group.lastElementChild).toBe(total);
    });
});
