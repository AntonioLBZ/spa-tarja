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

function table() {
    const toggle = screen.getByRole('button', { name: text.showNumbers });
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
    return screen.getByRole('table', { name: text.spendingTitle });
}

function rows() {
    return within(table()).getAllByRole('row').slice(1);
}

function rowOf(label: string | RegExp) {
    const found = rows().find((item) =>
        typeof label === 'string' ? item.textContent?.includes(label) : label.test(item.textContent ?? '')
    );
    if (!found) throw new Error(`No row for ${String(label)}`);
    return found;
}

function chart() {
    return document.querySelector<SVGSVGElement>('svg[role="img"]');
}

function plot() {
    const found = chart();
    if (!found) throw new Error('No chart');
    return found;
}

function columns() {
    return [...plot().querySelectorAll<SVGRectElement>('.spending-chart__column')];
}

function slots() {
    return [...plot().querySelectorAll<SVGRectElement>('.spending-chart__slot')];
}

function shareOf(element: Element) {
    return Number((element as SVGElement).style.getPropertyValue('--share'));
}

function readout() {
    return document.getElementById(plot().getAttribute('aria-describedby')!)!;
}

function changeLine() {
    return screen.getByText(text.total).closest('p')!.nextElementSibling!;
}

function period(from: Date, to: Date, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
    return new Intl.DateTimeFormat('en', options).formatRange(from, to);
}

const percent = (share: number) =>
    new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(
        share
    );

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

        expect(rows()).toHaveLength(31);
        expect(rows()[0]!.textContent).toContain('Oct 1');
        expect(rows().at(-1)!.textContent).toContain('Oct 31');
    });

    it('shows what is still to be charged later in the month, the way the summary counts it', async () => {
        await open([expense({ amountCents: 1800, date: '2026-09-20', payment: 'credit', chargeDate: '2026-10-28' })]);

        expect(rowOf('Oct 28').textContent).toContain('€18.00');
        expect(screen.getByText(text.total).closest('p')!.textContent).toContain('€18.00');
    });

    it('names each day with its weekday, and the year only when the range needs it', async () => {
        await open();

        expect(rows()[24]!.textContent).toContain('Sun, Oct 25');
        expect(rows()[0]!.textContent).toContain('Thu, Oct 1');
        expect(rows()[24]!.textContent).not.toContain('2026');
    });

    it('adds the year to the names when the range goes over a New Year', async () => {
        await open();

        dates('2025-12-30', '2026-01-02');

        expect(rows().map((item) => item.textContent)).toEqual([
            expect.stringContaining('Tue, Dec 30, 2025'),
            expect.stringContaining('Wed, Dec 31, 2025'),
            expect.stringContaining('Thu, Jan 1, 2026'),
            expect.stringContaining('Fri, Jan 2, 2026'),
        ]);
    });

    it('adds up each day, leaving the quiet ones at zero', async () => {
        await open();

        expect(rowOf('Oct 25').textContent).toContain('€48.99');
        expect(rowOf('Oct 24').textContent).toContain('€12.50');
        expect(rowOf('Oct 3').textContent).toContain('€0.00');
    });

    it('counts a deferred expense on the day it is charged', async () => {
        await open();

        expect(rowOf('Oct 2').textContent).toContain('€8.00');
    });

    it('says the total of the period, deleted expenses and other months left out', async () => {
        await open();

        expect(screen.getByText(text.total).closest('p, div, li')!.textContent).toContain('€89.49');
    });

    it('draws a column for every day, as a share of the top of the scale, and none for an empty day', async () => {
        await open();

        expect(columns()).toHaveLength(31);
        expect(shareOf(columns()[24]!)).toBeCloseTo(4899 / 5000, 5);
        expect(shareOf(columns()[23]!)).toBeCloseTo(1250 / 5000, 5);
        expect(shareOf(columns()[2]!)).toBe(0);
    });

    it('draws nothing when there is nothing to compare', async () => {
        await open([]);

        for (const column of columns()) {
            expect(shareOf(column)).toBe(0);
        }
    });
});

describe('the chart', () => {
    it('labels a round scale in whole euros when the steps are whole euros', async () => {
        await open();

        const ticks = [...document.querySelectorAll('.spending-chart__tick')];
        expect(ticks.map((tick) => tick.textContent)).toEqual(['€0', '€25', '€50']);
        expect(ticks[0]!.closest('[aria-hidden="true"]')).not.toBeNull();
    });

    it('keeps the cents on the scale when the steps need them', async () => {
        await open([expense({ amountCents: 30, date: '2026-10-25' })]);

        expect([...document.querySelectorAll('.spending-chart__tick')].map((tick) => tick.textContent)).toEqual([
            '€0.00',
            '€0.10',
            '€0.20',
            '€0.30',
        ]);
    });

    it('draws a hairline at every tick but the baseline', async () => {
        await open();

        expect(plot().querySelectorAll('.spending-chart__grid')).toHaveLength(2);
    });

    it('names the first and the last row under the chart', async () => {
        await open();

        expect([...document.querySelectorAll('.spending-chart__axis > *')].map((label) => label.textContent)).toEqual([
            'Oct 1',
            'Oct 31',
        ]);
    });

    it('marks the biggest column with a cap and today with a frame, by shape', async () => {
        await open();

        const peak = plot().querySelectorAll<SVGRectElement>('.spending-chart__peak');
        const today = plot().querySelectorAll<SVGRectElement>('.spending-chart__today');
        expect(peak).toHaveLength(1);
        expect(Number(peak[0]!.getAttribute('x'))).toBe(Number(columns()[24]!.getAttribute('x')));
        expect(Number(peak[0]!.getAttribute('width'))).toBe(Number(columns()[24]!.getAttribute('width')));
        expect(today).toHaveLength(1);
        expect(Number(today[0]!.getAttribute('x'))).toBe(24);
    });

    it('marks the first of the biggest columns when they tie, and none when nothing was spent', async () => {
        await open([
            expense({ amountCents: 500, date: '2026-10-03' }),
            expense({ amountCents: 500, date: '2026-10-07' }),
        ]);

        const peak = plot().querySelector<SVGRectElement>('.spending-chart__peak')!;
        expect(Number(peak.getAttribute('x'))).toBe(Number(columns()[2]!.getAttribute('x')));

        dates('2026-10-10', '2026-10-20');

        expect(plot().querySelector('.spending-chart__peak')).toBeNull();
    });

    it('frames no row when today is outside the range', async () => {
        await open();

        dates('2026-09-01', '2026-09-30');

        expect(plot().querySelector('.spending-chart__today')).toBeNull();
    });

    it('frames the week and the month today falls in', async () => {
        await open();

        groupBy(text.group.week);
        expect(Number(plot().querySelector('.spending-chart__today')!.getAttribute('x'))).toBe(11);

        groupBy(text.group.month);
        expect(Number(plot().querySelector('.spending-chart__today')!.getAttribute('x'))).toBe(11);
    });

    it('paints the columns in the accent with square corners, while the category icons keep their colors', async () => {
        await open();

        for (const mark of plot().querySelectorAll('rect')) {
            expect(mark.getAttribute('rx')).toBeNull();
            expect(mark.getAttribute('ry')).toBeNull();
            expect(mark.getAttribute('fill')).toBeNull();
            expect(mark.getAttribute('class')).not.toMatch(/category/);
        }
        expect(breakdown()[0]!.querySelector('.category-badge--green')).not.toBeNull();
    });

    it('sets the columns apart while there are few, and lets many touch', async () => {
        await open();
        const widthOf = (column: Element) => Number(column.getAttribute('width'));

        expect(widthOf(columns()[0]!)).toBeLessThan(1);

        dates('2026-01-01', '2026-10-31');

        expect(widthOf(columns()[0]!)).toBe(1);
    });

    it('keeps every column at least a pixel wide, scrolling inside its box rather than squeezing', async () => {
        await open();

        dates('2026-01-01', addDays('2026-01-01', MAX_BUCKETS - 1));

        expect(plot().style.getPropertyValue('--columns')).toBe(String(MAX_BUCKETS));
        expect(plot().getAttribute('viewBox')).toMatch(new RegExp(`^0 0 ${MAX_BUCKETS} `));
    });
});

describe('reading a column', () => {
    const readoutOf = (label: string, amount: string) => t('charts.readout', { label, amount });

    it('says how to pick a column until one is picked', async () => {
        await open();

        expect(readout().textContent).toBe(text.readoutHint);
        expect(readout().getAttribute('aria-live')).toBe('polite');
    });

    it('is one tab stop', async () => {
        await open();

        expect(plot().getAttribute('tabindex')).toBe('0');
        expect(plot().querySelectorAll('[tabindex]')).toHaveLength(0);
        expect(document.querySelectorAll('.spending-chart [tabindex]')).toHaveLength(1);
    });

    it('moves along the columns with the arrows, and jumps to the ends with Home and End', async () => {
        await open();

        fireEvent.keyDown(plot(), { key: 'ArrowRight' });
        expect(readout().textContent).toBe(readoutOf('Thu, Oct 1', '€0.00'));

        fireEvent.keyDown(plot(), { key: 'ArrowRight' });
        expect(readout().textContent).toBe(readoutOf('Fri, Oct 2', '€8.00'));

        fireEvent.keyDown(plot(), { key: 'End' });
        expect(readout().textContent).toBe(readoutOf('Sat, Oct 31', '€0.00'));

        fireEvent.keyDown(plot(), { key: 'ArrowRight' });
        expect(readout().textContent).toBe(readoutOf('Sat, Oct 31', '€0.00'));

        fireEvent.keyDown(plot(), { key: 'ArrowLeft' });
        expect(readout().textContent).toBe(readoutOf('Fri, Oct 30', '€0.00'));

        fireEvent.keyDown(plot(), { key: 'Home' });
        expect(readout().textContent).toBe(readoutOf('Thu, Oct 1', '€0.00'));

        fireEvent.keyDown(plot(), { key: 'ArrowLeft' });
        expect(readout().textContent).toBe(readoutOf('Thu, Oct 1', '€0.00'));
    });

    it('starts from the last column with the left arrow', async () => {
        await open();

        fireEvent.keyDown(plot(), { key: 'ArrowLeft' });

        expect(readout().textContent).toBe(readoutOf('Sat, Oct 31', '€0.00'));
    });

    it('leaves the page alone on the keys it answers, and answers no other', async () => {
        await open();

        expect(fireEvent.keyDown(plot(), { key: 'ArrowRight' })).toBe(false);
        expect(fireEvent.keyDown(plot(), { key: 'ArrowDown' })).toBe(true);
        expect(fireEvent.keyDown(plot(), { key: 'a' })).toBe(true);
        expect(readout().textContent).toBe(readoutOf('Thu, Oct 1', '€0.00'));
    });

    it('picks the column whose slot is tapped, and marks it', async () => {
        await open();

        fireEvent.click(slots()[24]!);

        expect(readout().textContent).toBe(readoutOf('Sun, Oct 25', '€48.99'));
        expect(slots()[24]!.classList.contains('spending-chart__slot--selected')).toBe(true);
        expect(columns()[24]!.classList.contains('spending-chart__column--selected')).toBe(true);
        expect(document.querySelectorAll('.spending-chart__slot--selected')).toHaveLength(1);

        fireEvent.keyDown(plot(), { key: 'ArrowLeft' });

        expect(readout().textContent).toBe(readoutOf('Sat, Oct 24', '€12.50'));
    });

    it('names the category picked, and keeps the column when the category changes', async () => {
        await open();
        fireEvent.click(slots()[24]!);

        pickCategory(text.category, en.categories.food);

        expect(readout().textContent).toBe(
            t('charts.readoutCategory', { label: 'Sun, Oct 25', category: en.categories.food, amount: '€3.00' })
        );
    });

    it('lets go of a column that leaves the range', async () => {
        await open();
        fireEvent.click(slots()[24]!);

        dates('2026-10-01', '2026-10-20');

        expect(readout().textContent).toBe(text.readoutHint);
        expect(document.querySelectorAll('.spending-chart__slot--selected')).toHaveLength(0);

        dates('2026-10-01', '2026-10-31');

        expect(readout().textContent).toBe(text.readoutHint);
    });

    it('reads a week by its name', async () => {
        await open();
        groupBy(text.group.week);

        fireEvent.keyDown(plot(), { key: 'End' });

        expect(readout().textContent).toBe(readoutOf(weekOf('Oct 19'), '€61.49'));
    });
});

describe('the text alternative', () => {
    it('sums the chart up in its label: how many rows, the total and the biggest', async () => {
        await open();

        expect(plot().getAttribute('aria-label')).toBe(
            t('charts.chartSummary', {
                span: t('charts.chartSpan', { granularity: 'day', count: 31 }),
                total: '€89.49',
                biggest: '€48.99',
                label: 'Sun, Oct 25',
            })
        );
    });

    it('counts weeks and months in the label', async () => {
        await open();

        groupBy(text.group.week);
        expect(plot().getAttribute('aria-label')).toBe(
            t('charts.chartSummary', {
                span: t('charts.chartSpan', { granularity: 'week', count: 12 }),
                total: '€96.49',
                biggest: '€61.49',
                label: weekOf('Oct 19'),
            })
        );

        dates('2026-10-01', '2026-10-31');
        groupBy(text.group.month);
        expect(plot().getAttribute('aria-label')).toBe(
            t('charts.chartSummary', {
                span: t('charts.chartSpan', { granularity: 'month', count: 1 }),
                total: '€89.49',
                biggest: '€89.49',
                label: 'October 2026',
            })
        );
    });

    it('says nothing was spent when nothing was', async () => {
        await open([]);

        expect(plot().getAttribute('aria-label')).toBe(
            t('charts.chartSummaryEmpty', { span: t('charts.chartSpan', { granularity: 'day', count: 31 }) })
        );
    });

    it('keeps the numbers behind a closed disclosure until asked for', async () => {
        await open();

        const toggle = screen.getByRole('button', { name: text.showNumbers });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByRole('table')).toBeNull();

        fireEvent.click(toggle);

        expect(screen.getByRole('table', { name: text.spendingTitle })).toBeDefined();
    });

    it('lists every row in a table under the grouping and the amount, empty ones included', async () => {
        await open();

        const headers = within(table())
            .getAllByRole('columnheader')
            .map((cell) => cell.textContent);
        expect(headers).toEqual([text.group.day, text.amount]);
        expect(rows()).toHaveLength(31);
        expect(rows().filter((row) => row.textContent?.endsWith('€0.00'))).toHaveLength(27);
        expect(within(rows()[24]!).getByRole('rowheader').textContent).toBe('Sun, Oct 25');
        expect(within(rows()[24]!).getByRole('cell').textContent).toBe('€48.99');
    });

    it('names the column of the table after the grouping', async () => {
        await open();

        groupBy(text.group.month);

        expect(within(table()).getAllByRole('columnheader')[0]!.textContent).toBe(text.group.month);
    });
});

describe('the stat row', () => {
    it('compares the total with as many days right before', async () => {
        await open();

        expect(changeLine().textContent).toBe(
            `↑${t('charts.vsPrevious', { change: percent(8249 / 700), period: period(new Date(2026, 7, 31), new Date(2026, 8, 30)) })}`
        );
        expect(changeLine().querySelector('[aria-hidden="true"]')!.textContent).toBe('↑');
    });

    it('compares the same category on both sides', async () => {
        await open();

        pickCategory(text.category, en.categories.food);

        expect(screen.getByText(text.total).closest('p')!.textContent).toContain('€15.50');
        expect(changeLine().textContent).toContain(percent(850 / 700));
    });

    it('shows a fall with the arrow down and the sign', async () => {
        await open([
            expense({ amountCents: 500, date: '2026-10-05' }),
            expense({ amountCents: 1000, date: '2026-09-15' }),
        ]);

        expect(changeLine().textContent).toBe(
            `↓${t('charts.vsPrevious', { change: percent(-0.5), period: period(new Date(2026, 7, 31), new Date(2026, 8, 30)) })}`
        );
    });

    it('shows no arrow when nothing changed', async () => {
        await open([
            expense({ amountCents: 500, date: '2026-10-05' }),
            expense({ amountCents: 500, date: '2026-09-15' }),
        ]);

        expect(changeLine().textContent).toBe(
            t('charts.vsPrevious', { change: percent(0), period: period(new Date(2026, 7, 31), new Date(2026, 8, 30)) })
        );
        expect(changeLine().querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('says when there is nothing to compare with, and which days it looked at', async () => {
        await open();

        pickCategory(text.category, en.categories.leisure);

        expect(changeLine().textContent).toBe(
            t('charts.noPrevious', { period: period(new Date(2026, 7, 31), new Date(2026, 8, 30)) })
        );
        expect(changeLine().querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('compares whole weeks and whole months', async () => {
        await open();

        groupBy(text.group.week);
        expect(changeLine().textContent).toBe(
            t('charts.noPrevious', { period: period(new Date(2026, 4, 11), new Date(2026, 7, 2)) })
        );

        groupBy(text.group.month);
        expect(changeLine().textContent).toBe(
            t('charts.noPrevious', {
                period: period(new Date(2024, 10, 1), new Date(2025, 9, 31), { month: 'short', year: 'numeric' }),
            })
        );
    });

    it('gives the year of a previous period that is not this one', async () => {
        await open();

        dates('2026-01-01', '2026-01-31');

        expect(changeLine().textContent).toBe(
            t('charts.noPrevious', {
                period: period(new Date(2025, 11, 1), new Date(2025, 11, 31), {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
            })
        );
    });

    it('stays for a range too long to draw', async () => {
        await open();

        dates('2020-01-01', '2026-10-31');

        expect(changeLine().textContent).toContain(text.noPrevious.split(' (')[0]!);
    });
});

describe('spending by week', () => {
    it('has twelve weeks counting this one, from Monday', async () => {
        await open();

        groupBy(text.group.week);

        expect(rows()).toHaveLength(12);
        expect(rows()[0]!.textContent).toContain(weekOf('Aug 3'));
        expect(rows().at(-1)!.textContent).toContain(weekOf('Oct 19'));
    });

    it('adds the year to the weeks when the range goes over a New Year', async () => {
        await open();
        dates('2025-12-01', '2026-01-10');

        groupBy(text.group.week);

        expect(rowOf(weekOf('Dec 29, 2025')).textContent).toContain('€0.00');
        expect(rows().at(-1)!.textContent).toContain(weekOf('Jan 5, 2026'));
    });

    it('adds up each week', async () => {
        await open();

        groupBy(text.group.week);

        expect(rowOf(weekOf('Oct 19')).textContent).toContain('€61.49');
        expect(rowOf(weekOf('Oct 5')).textContent).toContain('€20.00');
        expect(rowOf(weekOf('Sep 28')).textContent).toContain('€15.00');
    });
});

describe('spending by month', () => {
    it('has twelve months counting this one', async () => {
        await open();

        groupBy(text.group.month);

        expect(rows()).toHaveLength(12);
        expect(rows()[0]!.textContent).toContain('November 2025');
        expect(rows().at(-1)!.textContent).toContain('October 2026');
    });

    it('adds up each month', async () => {
        await open();

        groupBy(text.group.month);

        expect(rowOf('October 2026').textContent).toContain('€89.49');
        expect(rowOf('September 2026').textContent).toContain('€7.00');
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

        expect(rowOf('Oct 25').textContent).toContain('€3.00');
        expect(rowOf('Oct 24').textContent).toContain('€12.50');
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

        expect(rows()).toHaveLength(2);
        expect(screen.getByText(text.total).closest('p, div, li')!.textContent).toContain('€61.49');
    });

    it('can reach back to other months', async () => {
        await open();

        dates('2026-09-01', '2026-09-30');
        groupBy(text.group.month);

        expect(rows()).toHaveLength(1);
        expect(rowOf('September 2026').textContent).toContain('€7.00');
    });

    it('stay as picked when the grouping changes', async () => {
        await open();
        dates('2026-10-10', '2026-10-25');

        groupBy(text.group.week);

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-10');
        expect(rows()).toHaveLength(3);
    });

    it('offer to go back to the usual ones only once they were changed', async () => {
        await open();
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();
        dates('2026-10-24', '2026-10-25');

        fireEvent.click(screen.getByRole('button', { name: text.resetRange }));

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
        expect(rows()).toHaveLength(31);
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();
    });

    it('are refused when the start is after the end, with no chart', async () => {
        await open();

        dates('2026-10-25', '2026-10-24');

        expect((await screen.findByRole('alert')).textContent).toBe(text.rangeInvalid);
        expect(chart()).toBeNull();
        expect(screen.queryByRole('button', { name: text.showNumbers })).toBeNull();
        expect(screen.queryByRole('list', { name: text.byCategory })).toBeNull();
        expect(screen.queryByText(text.total)).toBeNull();
        expect(screen.queryByText(text.empty)).toBeNull();
        expect(screen.getByLabelText(text.from).getAttribute('aria-invalid')).toBe('true');
    });

    it('allow a single day, the same at both ends', async () => {
        await open();

        dates('2026-10-25', '2026-10-25');

        expect(screen.queryByRole('alert')).toBeNull();
        expect(rows()).toHaveLength(1);
        expect(rowOf('Oct 25').textContent).toContain('€48.99');
    });

    it('keep the chart on the last good range while a date is half typed, and go back to it when the field is left', async () => {
        await open();
        const from = screen.getByLabelText(text.from) as HTMLInputElement;

        fireEvent.change(from, { target: { value: '' } });

        expect(from.value).toBe('');
        expect(rows()).toHaveLength(31);
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
            expect(rows()).toHaveLength(31);
        }
        fireEvent.change(from, { target: { value: '2026-10-05' } });

        expect(rows()).toHaveLength(27);
        expect(from.value).toBe('2026-10-05');
    });

    it('ignore years that cannot be right, before 2000 and after 2099', async () => {
        await open();

        for (const day of ['1999-12-31', '2100-01-01']) {
            fireEvent.change(screen.getByLabelText(text.from), { target: { value: day } });
            expect(rows()).toHaveLength(31);
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
        expect(chart()).toBeNull();
        expect(screen.queryByRole('button', { name: text.showNumbers })).toBeNull();
        expect(screen.getByText(text.total).closest('p')!.textContent).toContain('€96.49');
        expect(breakdown()).toHaveLength(3);
        expect(screen.getByLabelText(text.from).getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByLabelText(text.from).getAttribute('aria-describedby')).toBe(message.id);
    });

    it('are drawn up to the most rows the chart allows, and refused with one more', async () => {
        await open();

        dates('2026-01-01', addDays('2026-01-01', MAX_BUCKETS - 1));
        expect(rows()).toHaveLength(MAX_BUCKETS);
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
        expect(rows()).toHaveLength(82);
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

        await waitFor(() => expect(rowOf('Oct 25').textContent).toContain('€7.00'));
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
        fireEvent.click(screen.getByRole('button', { name: es.charts.showNumbers }));

        expect(screen.getByText(/25 oct/)).toBeDefined();
        fireEvent.click(screen.getByRole('radio', { name: es.charts.group.week }));
        expect(screen.getByText(tEs('charts.weekOf', { date: '19 oct' }))).toBeDefined();
        fireEvent.click(screen.getByRole('radio', { name: es.charts.group.month }));
        expect(screen.getByText(/octubre de 2026/)).toBeDefined();
        expect(screen.getAllByText(formatAmount(8949, 'EUR', 'es').replace(/\s/g, ' ')).length).toBeGreaterThan(0);
    });

    it('reads a column and the change the Spanish way', async () => {
        stubApi(createFakeApi({ expenses: EXPENSES }).handler);
        renderApp({ path: '/charts' });
        await screen.findByRole('heading', { name: es.charts.title });
        await waitFor(() => expect(slots()[24]).toBeDefined());

        fireEvent.click(slots()[24]!);

        expect(readout().textContent).toBe(
            tEs('charts.readout', { label: 'dom, 25 oct', amount: formatAmount(4899, 'EUR', 'es') })
        );
        expect(changeLine().textContent).toBe(
            `↑${tEs('charts.vsPrevious', {
                change: new Intl.NumberFormat('es', {
                    style: 'percent',
                    maximumFractionDigits: 0,
                    signDisplay: 'exceptZero',
                }).format(8249 / 700),
                period: new Intl.DateTimeFormat('es', { month: 'short', day: 'numeric' }).formatRange(
                    new Date(2026, 7, 31),
                    new Date(2026, 8, 30)
                ),
            })}`
        );
    });
});
