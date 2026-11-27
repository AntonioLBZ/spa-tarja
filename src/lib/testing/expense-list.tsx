import { fireEvent, screen, within } from '@testing-library/react';

import en from '@/assets/locales/en.json';
import { expense, t, TODAY } from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { pickOption } from '@/lib/testing/select';
import { addMonths } from '@core/basics/date';
import { type Expense } from '@core/expenses/expense';

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

const format = (options: Intl.DateTimeFormatOptions, isoDay: string) => {
    return new Intl.DateTimeFormat('en', options).format(new Date(`${isoDay}T12:00:00`));
};

const longDay = (isoDay: string) => format({ weekday: 'long', day: 'numeric', month: 'long' }, isoDay);

const sofa = (amountCents = 500) => {
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
};

const open = async (expenses: Expense[], first = expenses[0]!.text) => {
    const api = createFakeApi({ expenses });
    stubApi(api.handler);
    const app = renderApp();
    await screen.findByText(first);
    return { api, app };
};

// With every date, as the list was before it opened on this month
const openAll = async (expenses: Expense[], first = expenses[0]!.text) => {
    const api = createFakeApi({ expenses });
    stubApi(api.handler);
    const app = renderApp();
    await screen.findByRole('searchbox', { name: f.search });
    fireEvent.click(filtersToggle());
    fireEvent.change(screen.getByLabelText(f.from), { target: { value: '' } });
    fireEvent.click(filtersToggle());
    await screen.findByText(first);
    return { api, app };
};

const filtersToggle = (count?: number) =>
    screen.getByRole('button', {
        name: count === undefined ? /^Filters/ : t('expenses.filters.toggle', { count }),
    });

const filtersSheet = () => screen.getByText(f.title, { selector: 'h2' }).closest('dialog')!;

const openFilters = () => {
    if (!filtersSheet().open) fireEvent.click(filtersToggle());
};

const closeFilters = () => {
    if (filtersSheet().open) fireEvent.click(within(filtersSheet()).getByRole('button', { name: f.close }));
};

const searchBox = () => screen.getByRole('searchbox', { name: f.search }) as HTMLInputElement;

const search = (value: string) => {
    closeFilters();
    fireEvent.change(searchBox(), { target: { value } });
};

const pickGrouping = (name: string) => {
    openFilters();
    pickOption(f.groupBy, name);
    closeFilters();
};

const rowNames = () =>
    screen
        .queryAllByRole('listitem')
        .map((row) => row.querySelector('.expense-item__text')?.textContent)
        .filter(Boolean);

const groupHeadings = () =>
    screen
        .queryAllByRole('heading', { level: 2 })
        .filter((heading) => !heading.closest('dialog'))
        .map((heading) => heading.textContent);

const subtotalOf = (label: string) =>
    screen.getByRole('heading', { level: 2, name: label }).closest('section')?.querySelector('.expense-list__subtotal')
        ?.textContent;

const statusRegion = () =>
    document.querySelector<HTMLElement>('.expense-list-controls > .filter-status [role="status"]')!;

const statusLine = () => document.querySelector<HTMLElement>('.expense-list-controls > .filter-status')!;

const clear = () => {
    closeFilters();
    fireEvent.click(screen.getByRole('button', { name: f.clear }));
};

const showing = (shownCount: number, total: number) =>
    within(statusLine()).queryByText(t('expenses.filters.showing', { shown: shownCount, total }), {
        selector: 'p',
    });

const noMatch = () => within(statusLine()).queryByText(en.expenses.list.noMatch, { selector: 'p' });

export {
    cafe,
    cinema,
    clear,
    closeFilters,
    f,
    filtersSheet,
    filtersToggle,
    format,
    groupHeadings,
    list,
    longDay,
    noMatch,
    open,
    openAll,
    openFilters,
    pickGrouping,
    rent,
    root,
    rowNames,
    search,
    searchBox,
    shop,
    showing,
    sofa,
    statusLine,
    statusRegion,
    subtotalOf,
};
