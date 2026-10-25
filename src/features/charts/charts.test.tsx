import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { CATEGORIES_KEY, EXPENSES_KEY } from '@/lib/api';
import { categoryNames, chosenCategory, pickCategory } from '@/lib/test/category-select';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { DEFAULT_CATEGORY_IDS } from '@core/categories';
import { MAX_BUCKETS } from '@core/charts';
import { addDays } from '@core/date';
import { formatAmount } from '@core/money';

import type { Expense } from '@core/expense';

const text = en.charts;
const t = createTranslator({ locale: 'en', messages: en });
const tEs = createTranslator({ locale: 'es', messages: es });
const weekOf = (date: string) => t('charts.weekOf', { date });

function expense(overrides: Partial<Expense> = {}): Expense {
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
}

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

async function open(expenses: Expense[] = EXPENSES, options: Parameters<typeof createFakeApi>[0] = {}) {
    stubApi(createFakeApi({ expenses, ...options }).handler);
    const app = renderApp({ path: '/charts' });
    await screen.findByRole('heading', { name: text.title });
    await waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
    return app;
}

function bars() {
    return within(screen.getByRole('list', { name: text.spendingTitle })).getAllByRole('listitem');
}

function barOf(label: string | RegExp) {
    const found = bars().find((item) =>
        typeof label === 'string' ? item.textContent?.includes(label) : label.test(item.textContent ?? '')
    );
    if (!found) throw new Error(`No bar for ${String(label)}`);
    return found;
}

function breakdown() {
    return within(screen.getByRole('list', { name: text.byCategory })).getAllByRole('listitem');
}

function groupBy(label: string) {
    fireEvent.click(screen.getByRole('radio', { name: label }));
}

function dates(from: string, to: string) {
    fireEvent.change(screen.getByLabelText(text.from), { target: { value: from } });
    fireEvent.change(screen.getByLabelText(text.to), { target: { value: to } });
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('spending by day', () => {
    it('is what the page starts with, for the whole month, a row for every day', async () => {
        await open();

        expect(bars()).toHaveLength(31);
        expect(bars()[0]!.textContent).toContain('Oct 1');
        expect(bars().at(-1)!.textContent).toContain('Oct 31');
    });

    it('shows what is still to be charged later in the month, the way the summary counts it', async () => {
        await open([expense({ amountCents: 1800, date: '2026-09-20', payment: 'voucher', chargeDate: '2026-10-28' })]);

        expect(barOf('Oct 28').textContent).toContain('€18.00');
        expect(screen.getByText(text.total).closest('p')!.textContent).toContain('€18.00');
    });

    it('names each day with its weekday, and the year only when the range needs it', async () => {
        await open();

        expect(bars()[24]!.textContent).toContain('Sun, Oct 25');
        expect(bars()[0]!.textContent).toContain('Thu, Oct 1');
        expect(bars()[24]!.textContent).not.toContain('2026');
    });

    it('adds the year to the names when the range goes over a New Year', async () => {
        await open();

        dates('2025-12-30', '2026-01-02');

        expect(bars().map((item) => item.textContent)).toEqual([
            expect.stringContaining('Tue, Dec 30, 2025'),
            expect.stringContaining('Wed, Dec 31, 2025'),
            expect.stringContaining('Thu, Jan 1, 2026'),
            expect.stringContaining('Fri, Jan 2, 2026'),
        ]);
    });

    it('adds up each day, leaving the quiet ones at zero', async () => {
        await open();

        expect(barOf('Oct 25').textContent).toContain('€48.99');
        expect(barOf('Oct 24').textContent).toContain('€12.50');
        expect(barOf('Oct 3').textContent).toContain('€0.00');
    });

    it('counts a deferred expense on the day it is charged', async () => {
        await open();

        expect(barOf('Oct 2').textContent).toContain('€8.00');
    });

    it('says the total of the period, deleted expenses and other months left out', async () => {
        await open();

        expect(screen.getByText(text.total).closest('p, div, li')!.textContent).toContain('€89.49');
    });

    it('draws each bar as a share of the biggest, and none for an empty day', async () => {
        await open();

        const share = (label: string) =>
            barOf(label).querySelector<HTMLElement>('.bar__fill')!.style.getPropertyValue('--share');
        expect(Number(share('Oct 25'))).toBe(1);
        expect(Number(share('Oct 24'))).toBeCloseTo(1250 / 4899, 5);
        expect(Number(share('Oct 3'))).toBe(0);
    });

    it('draws nothing when there is nothing to compare', async () => {
        await open([]);

        for (const item of bars()) {
            expect(Number(item.querySelector<HTMLElement>('.bar__fill')!.style.getPropertyValue('--share'))).toBe(0);
        }
    });
});

describe('spending by week', () => {
    it('has twelve weeks counting this one, from Monday', async () => {
        await open();

        groupBy(text.group.week);

        expect(bars()).toHaveLength(12);
        expect(bars()[0]!.textContent).toContain(weekOf('Aug 3'));
        expect(bars().at(-1)!.textContent).toContain(weekOf('Oct 19'));
    });

    it('adds the year to the weeks when the range goes over a New Year', async () => {
        await open();
        dates('2025-12-01', '2026-01-10');

        groupBy(text.group.week);

        expect(barOf(weekOf('Dec 29, 2025')).textContent).toContain('€0.00');
        expect(bars().at(-1)!.textContent).toContain(weekOf('Jan 5, 2026'));
    });

    it('adds up each week', async () => {
        await open();

        groupBy(text.group.week);

        expect(barOf(weekOf('Oct 19')).textContent).toContain('€61.49');
        expect(barOf(weekOf('Oct 5')).textContent).toContain('€20.00');
        expect(barOf(weekOf('Sep 28')).textContent).toContain('€15.00');
    });
});

describe('spending by month', () => {
    it('has twelve months counting this one', async () => {
        await open();

        groupBy(text.group.month);

        expect(bars()).toHaveLength(12);
        expect(bars()[0]!.textContent).toContain('November 2025');
        expect(bars().at(-1)!.textContent).toContain('October 2026');
    });

    it('adds up each month', async () => {
        await open();

        groupBy(text.group.month);

        expect(barOf('October 2026').textContent).toContain('€89.49');
        expect(barOf('September 2026').textContent).toContain('€7.00');
    });
});

describe('by category', () => {
    it('lists each category with what it took, the biggest first, and its share', async () => {
        await open();

        expect(breakdown().map((item) => item.textContent)).toEqual([
            expect.stringContaining(`${en.categories.groceries}€45.99`),
            expect.stringContaining(`${en.categories.leisure}€28.00`),
            expect.stringContaining(`${en.categories.food}€15.50`),
        ]);
        expect(breakdown()[0]!.textContent).toContain('51%');
        expect(breakdown()[1]!.textContent).toContain('31%');
        expect(breakdown()[2]!.textContent).toContain('17%');
    });

    it('shows the icon of each category next to its name', async () => {
        await open();

        expect(breakdown()[0]!.querySelector('[data-icon]')).not.toBeNull();
    });

    it('names a custom category, and shows a deleted one as the fallback', async () => {
        const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;
        await open(
            [
                expense({ categoryId: gym.id, amountCents: 5000 }),
                expense({ categoryId: crypto.randomUUID(), amountCents: 300 }),
                expense({ categoryId: 'other', amountCents: 200 }),
            ],
            { categories: [gym] }
        );

        expect(breakdown().map((item) => item.textContent)).toEqual([
            expect.stringContaining('Gym€50.00'),
            expect.stringContaining(`${en.categories.other}€5.00`),
        ]);
    });

    it('puts the categories that took the same in the order of their names, not of their ids', async () => {
        const zumba = {
            id: '00000000-0000-4000-8000-000000000000',
            name: 'Zumba',
            color: 'blue',
            icon: 'fitness_center',
        } as const;
        const aikido = {
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            name: 'Aikido',
            color: 'green',
            icon: 'spa',
        } as const;

        await open(
            [expense({ categoryId: zumba.id, amountCents: 100 }), expense({ categoryId: aikido.id, amountCents: 100 })],
            { categories: [zumba, aikido] }
        );

        expect(breakdown().map((item) => item.textContent)).toEqual([
            expect.stringContaining('Aikido'),
            expect.stringContaining('Zumba'),
        ]);
    });

    it('does not fold what it cannot name into Other before the categories are known', async () => {
        const api = createFakeApi({
            expenses: [
                expense({ categoryId: crypto.randomUUID(), amountCents: 300 }),
                expense({ categoryId: 'other', amountCents: 200 }),
            ],
        });
        stubApi((url, init) =>
            url.pathname === '/api/categories' ? new Response(null, { status: 500 }) : api.handler(url, init)
        );
        const app = renderApp({ path: '/charts' });
        await screen.findByRole('heading', { name: text.title });
        await waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
        await waitFor(() => expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('error'));

        expect(breakdown().map((item) => item.textContent)).toEqual([
            expect.stringContaining('€3.00'),
            expect.stringContaining('€2.00'),
        ]);
    });

    it('is not asked for when nothing was spent, and says so', async () => {
        await open([]);

        expect(screen.queryByRole('list', { name: text.byCategory })).toBeNull();
        expect(screen.getByText(text.empty)).toBeDefined();
    });

    it('does not say it is empty when something was spent', async () => {
        await open();

        expect(screen.queryByText(text.empty)).toBeNull();
    });
});

describe('the category filter', () => {
    it('starts at every category and lists the built-in ones and the custom ones', async () => {
        const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;
        await open(EXPENSES, { categories: [gym] });

        expect(chosenCategory(text.category)).toBe(text.allCategories);
        expect(categoryNames(text.category)).toEqual([
            text.allCategories,
            ...DEFAULT_CATEGORY_IDS.map((id) => en.categories[id]),
            'Gym',
        ]);
    });

    it('narrows the bars and the total to one category', async () => {
        await open();

        pickCategory(text.category, en.categories.food);

        expect(barOf('Oct 25').textContent).toContain('€3.00');
        expect(barOf('Oct 24').textContent).toContain('€12.50');
        expect(screen.getByText(text.total).closest('p, div, li')!.textContent).toContain('€15.50');
    });

    it('leaves the split by category alone', async () => {
        await open();

        pickCategory(text.category, en.categories.food);

        expect(breakdown()).toHaveLength(3);
    });
});

describe('the dates', () => {
    it('start at the first and the last day of the month for days', async () => {
        await open();

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
        expect((screen.getByLabelText(text.to) as HTMLInputElement).value).toBe('2026-10-31');
    });

    it('follow the grouping until the person picks some', async () => {
        await open();

        groupBy(text.group.month);

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2025-11-01');
        expect((screen.getByLabelText(text.to) as HTMLInputElement).value).toBe('2026-10-31');
    });

    it('narrow the chart to the days picked, both ends included', async () => {
        await open();

        dates('2026-10-24', '2026-10-25');

        expect(bars()).toHaveLength(2);
        expect(screen.getByText(text.total).closest('p, div, li')!.textContent).toContain('€61.49');
    });

    it('can reach back to other months', async () => {
        await open();

        dates('2026-09-01', '2026-09-30');
        groupBy(text.group.month);

        expect(bars()).toHaveLength(1);
        expect(barOf('September 2026').textContent).toContain('€7.00');
    });

    it('stay as picked when the grouping changes', async () => {
        await open();
        dates('2026-10-10', '2026-10-25');

        groupBy(text.group.week);

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-10');
        expect(bars()).toHaveLength(3);
    });

    it('offer to go back to the usual ones only once they were changed', async () => {
        await open();
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();
        dates('2026-10-24', '2026-10-25');

        fireEvent.click(screen.getByRole('button', { name: text.resetRange }));

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
        expect(bars()).toHaveLength(31);
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();
    });

    it('are refused when the start is after the end, with no chart', async () => {
        await open();

        dates('2026-10-25', '2026-10-24');

        expect((await screen.findByRole('alert')).textContent).toBe(text.rangeInvalid);
        expect(screen.queryByRole('list', { name: text.spendingTitle })).toBeNull();
        expect(screen.queryByRole('list', { name: text.byCategory })).toBeNull();
        expect(screen.queryByText(text.total)).toBeNull();
        expect(screen.queryByText(text.empty)).toBeNull();
        expect(screen.getByLabelText(text.from).getAttribute('aria-invalid')).toBe('true');
    });

    it('allow a single day, the same at both ends', async () => {
        await open();

        dates('2026-10-25', '2026-10-25');

        expect(screen.queryByRole('alert')).toBeNull();
        expect(bars()).toHaveLength(1);
        expect(barOf('Oct 25').textContent).toContain('€48.99');
    });

    it('keep the chart on the last good range while a date is half typed, and go back to it when the field is left', async () => {
        await open();
        const from = screen.getByLabelText(text.from) as HTMLInputElement;

        fireEvent.change(from, { target: { value: '' } });

        expect(from.value).toBe('');
        expect(bars()).toHaveLength(31);
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();

        fireEvent.blur(from);

        expect(from.value).toBe('2026-10-01');
    });

    it('ignore the years a field passes through while one is typed, and take the day once it is whole', async () => {
        await open();
        const from = screen.getByLabelText(text.from) as HTMLInputElement;

        for (const partial of ['0002-10-05', '0020-10-05', '0202-10-05']) {
            fireEvent.change(from, { target: { value: partial } });
            expect(from.value).toBe(partial);
            expect(bars()).toHaveLength(31);
        }
        fireEvent.change(from, { target: { value: '2026-10-05' } });

        expect(bars()).toHaveLength(27);
        expect(from.value).toBe('2026-10-05');
    });

    it('ignore years that cannot be right, before 2000 and after 2099', async () => {
        await open();

        for (const day of ['1999-12-31', '2100-01-01']) {
            fireEvent.change(screen.getByLabelText(text.from), { target: { value: day } });
            expect(bars()).toHaveLength(31);
        }
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();
    });

    it('accept the first and the last day that can be right', async () => {
        await open();

        dates('2000-01-01', '2099-12-31');

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2000-01-01');
        expect((screen.getByLabelText(text.to) as HTMLInputElement).value).toBe('2099-12-31');
        expect(screen.getByRole('button', { name: text.resetRange })).toBeDefined();
    });

    it('are explained by the message when the start is after the end', async () => {
        await open();

        dates('2026-10-25', '2026-10-24');

        const message = await screen.findByRole('alert');
        expect(screen.getByLabelText(text.from).getAttribute('aria-describedby')).toBe(message.id);
        expect(screen.getByLabelText(text.to).getAttribute('aria-describedby')).toBe(message.id);
    });

    it('are explained by nothing when they are fine', async () => {
        await open();

        expect(screen.getByLabelText(text.from).getAttribute('aria-describedby')).toBeNull();
    });

    it('are refused when the range would make too many rows, but the total and the split stay', async () => {
        await open();

        dates('2020-01-01', '2026-10-31');

        const message = await screen.findByRole('alert');
        expect(message.textContent).toBe(text.rangeTooLong);
        expect(screen.queryByRole('list', { name: text.spendingTitle })).toBeNull();
        expect(screen.getByText(text.total).closest('p')!.textContent).toContain('€96.49');
        expect(breakdown()).toHaveLength(3);
        expect(screen.getByLabelText(text.from).getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByLabelText(text.from).getAttribute('aria-describedby')).toBe(message.id);
    });

    it('are drawn up to the most rows the chart allows, and refused with one more', async () => {
        await open();

        dates('2026-01-01', addDays('2026-01-01', MAX_BUCKETS - 1));
        expect(bars()).toHaveLength(MAX_BUCKETS);
        expect(screen.queryByRole('alert')).toBeNull();

        dates('2026-01-01', addDays('2026-01-01', MAX_BUCKETS));
        expect((await screen.findByRole('alert')).textContent).toBe(text.rangeTooLong);
    });

    it('drop a half typed date along with the others when they are reset', async () => {
        await open();
        dates('2026-10-24', '2026-10-25');
        fireEvent.change(screen.getByLabelText(text.from), { target: { value: '0002-10-24' } });

        fireEvent.click(screen.getByRole('button', { name: text.resetRange }));

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
    });

    it('can still be drawn by month when it is too long to draw by day', async () => {
        await open();
        dates('2020-01-01', '2026-10-31');

        groupBy(text.group.month);

        expect(screen.queryByRole('alert')).toBeNull();
        expect(bars()).toHaveLength(82);
    });

    it('change only the end that was picked', async () => {
        await open();

        fireEvent.change(screen.getByLabelText(text.to), { target: { value: '2026-10-20' } });

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
        expect((screen.getByLabelText(text.to) as HTMLInputElement).value).toBe('2026-10-20');
    });

    it('are not complained about when they are fine', async () => {
        await open();

        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.getByLabelText(text.from).getAttribute('aria-invalid')).toBe('false');
    });
});

describe('the data', () => {
    it('includes what is saved on the device and not yet synced', async () => {
        const app = await open([]);

        await app.outbox.put(expense({ amountCents: 700, date: '2026-10-25' }));

        await waitFor(() => expect(barOf('Oct 25').textContent).toContain('€7.00'));
    });
});

describe('getting to the charts', () => {
    it('is one link away from the summary, and the summary is one back', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/summary' });

        fireEvent.click(await screen.findByRole('link', { name: en.summary.chartsLink }));
        expect(await screen.findByRole('heading', { name: text.title })).toBeDefined();

        fireEvent.click(screen.getByRole('link', { name: en.nav.summary }));
        expect(await screen.findByRole('heading', { name: en.summary.title })).toBeDefined();
    });
});

describe('in Spanish', () => {
    beforeEach(() => localStorage.setItem('tarja:locale', 'es'));
    afterEach(() => localStorage.clear());

    it('writes the weeks, the months, the days and the amounts the Spanish way', async () => {
        stubApi(createFakeApi({ expenses: EXPENSES }).handler);
        renderApp({ path: '/charts' });
        await screen.findByRole('heading', { name: es.charts.title });

        expect(screen.getByText(/25 oct/)).toBeDefined();
        fireEvent.click(screen.getByRole('radio', { name: es.charts.group.week }));
        expect(screen.getByText(tEs('charts.weekOf', { date: '19 oct' }))).toBeDefined();
        fireEvent.click(screen.getByRole('radio', { name: es.charts.group.month }));
        expect(screen.getByText(/octubre de 2026/)).toBeDefined();
        expect(screen.getAllByText(formatAmount(8949, 'EUR', 'es').replace(/\s/g, ' ')).length).toBeGreaterThan(0);
    });
});
