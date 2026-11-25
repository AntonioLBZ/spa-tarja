import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { CATEGORIES_KEY, EXPENSES_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/test/groups';
import { stubLanguages } from '@/lib/test/languages';
import { renderApp, stubApi } from '@/lib/test/render-app';
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
    return document.querySelector<SVGSVGElement>('svg[role="group"]');
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

function totalLine() {
    return document.querySelector('.spending-stats__total')!;
}

function changeLine() {
    return totalLine().nextElementSibling!;
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

function splitRow(name: string) {
    return within(screen.getByRole('list', { name: text.byCategory })).getByRole('button', {
        name: new RegExp(`^${name}`),
    });
}

function pick(name: string) {
    fireEvent.click(splitRow(name));
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
    stubLanguages(['en-GB']);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
        expect(totalLine().textContent).toContain('€18.00');
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

        expect(totalLine().textContent).toContain('€89.49');
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

    it('keeps a column with anything spent above the baseline, however small', async () => {
        await open([
            expense({ amountCents: 1, date: '2026-10-02' }),
            expense({ amountCents: 100_000, date: '2026-10-03' }),
        ]);

        expect(columns()[1]!.classList.contains('spending-chart__column--spent')).toBe(true);
        expect(columns()[2]!.classList.contains('spending-chart__column--spent')).toBe(true);
        expect(columns()[0]!.classList.contains('spending-chart__column--spent')).toBe(false);
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

    it('leaves the arrows to the browser while Alt, Ctrl or Meta is held', async () => {
        await open();

        for (const modifier of ['altKey', 'ctrlKey', 'metaKey']) {
            expect(fireEvent.keyDown(plot(), { key: 'ArrowLeft', [modifier]: true })).toBe(true);
            expect(fireEvent.keyDown(plot(), { key: 'Home', [modifier]: true })).toBe(true);
        }
        expect(readout().textContent).toBe(text.readoutHint);
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

        pick(en.categories.food);

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

    it('lets go of a column when the grouping changes, even where a row starts on the same day', async () => {
        await open();
        fireEvent.click(slots()[4]!);
        expect(readout().textContent).toBe(readoutOf('Mon, Oct 5', '€0.00'));

        groupBy(text.group.week);

        expect(readout().textContent).toBe(text.readoutHint);
        expect(document.querySelectorAll('.spending-chart__slot--selected')).toHaveLength(0);

        groupBy(text.group.day);

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

    it('is a group described as a chart, not an image, since it takes the focus and the arrow keys', async () => {
        await open();

        expect(plot().getAttribute('aria-roledescription')).toBe(text.chartRole);
        expect(document.querySelector('svg[role="img"]')).toBeNull();
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
    const SO_FAR = period(new Date(2026, 9, 1), new Date(2026, 9, 25));
    const SAME_DAYS = period(new Date(2026, 8, 1), new Date(2026, 8, 25));
    const monthsOf = (from: Date, to: Date) => period(from, to, { month: 'short', year: 'numeric' });

    it('compares a running month up to today with the same days of the month before, naming both sides', async () => {
        await open([...EXPENSES, expense({ amountCents: 700, date: '2026-09-10' })]);

        expect(totalLine().textContent).toContain('€89.49');
        expect(changeLine().textContent).toBe(
            `↑${t('charts.vsPreviousSoFar', { change: percent(8249 / 700), current: SO_FAR, period: SAME_DAYS })}`
        );
        expect(changeLine().querySelector('[aria-hidden="true"]')!.textContent).toBe('↑');
    });

    it('compares only the days so far, while the total holds the whole range', async () => {
        vi.setSystemTime(new Date(2026, 9, 3, 12));
        await open([
            expense({ amountCents: 500, date: '2026-10-02' }),
            expense({ amountCents: 4000, date: '2026-10-20' }),
            expense({ amountCents: 1000, date: '2026-09-02' }),
            expense({ amountCents: 7000, date: '2026-09-10' }),
        ]);

        expect(totalLine().textContent).toContain('€45.00');
        expect(changeLine().textContent).toBe(
            `↓${t('charts.vsPreviousSoFar', {
                change: percent(-0.5),
                current: period(new Date(2026, 9, 1), new Date(2026, 9, 3)),
                period: period(new Date(2026, 8, 1), new Date(2026, 8, 3)),
            })}`
        );
    });

    it('compares a picked part of a month with as many days before it, not with the month before', async () => {
        await open([
            expense({ amountCents: 500, date: '2026-09-20' }),
            expense({ amountCents: 1000, date: '2026-09-05' }),
            expense({ amountCents: 9000, date: '2026-08-10' }),
        ]);
        groupBy(text.group.month);

        dates('2026-09-15', '2026-09-30');

        expect(changeLine().textContent).toBe(
            `↓${t('charts.vsPrevious', {
                change: percent(-0.5),
                period: period(new Date(2026, 7, 30), new Date(2026, 8, 14)),
            })}`
        );
    });

    it('compares a whole month that is over with the month before, named as months', async () => {
        await open([
            expense({ amountCents: 700, date: '2026-09-30' }),
            expense({ amountCents: 1400, date: '2026-08-10' }),
        ]);
        groupBy(text.group.month);

        dates('2026-09-01', '2026-09-30');
        expect(changeLine().textContent).toBe(
            `↓${t('charts.vsPrevious', { change: percent(-0.5), period: monthsOf(new Date(2026, 7, 1), new Date(2026, 7, 31)) })}`
        );

        dates('2025-11-01', '2026-09-30');
        expect(changeLine().textContent).toBe(
            t('charts.noPrevious', { period: monthsOf(new Date(2024, 11, 1), new Date(2025, 9, 31)) })
        );
    });

    it('compares whole weeks that are over with as many weeks before', async () => {
        await open();

        groupBy(text.group.week);

        expect(changeLine().textContent).toBe(
            t('charts.noPrevious', { period: period(new Date(2026, 4, 11), new Date(2026, 7, 2)) })
        );
    });

    it('compares twelve running months with the twelve before, up to the same day a year back', async () => {
        await open();

        groupBy(text.group.month);

        const withYear = { month: 'short', day: 'numeric', year: 'numeric' } as const;
        expect(changeLine().textContent).toBe(
            t('charts.noPreviousSoFar', {
                current: period(new Date(2025, 10, 1), new Date(2026, 9, 25), withYear),
                period: period(new Date(2024, 10, 1), new Date(2025, 9, 25), withYear),
            })
        );
    });

    it('compares the same category on both sides', async () => {
        await open([...EXPENSES, expense({ amountCents: 700, date: '2026-09-10' })]);

        pick(en.categories.food);

        expect(totalLine().textContent).toContain('€15.50');
        expect(changeLine().textContent).toContain(percent(850 / 700));
    });

    it('counts a credit card expense in the span it is charged in, not the one it was made in', async () => {
        await open([
            expense({ amountCents: 1000, date: '2026-09-28', payment: 'credit', chargeDate: '2026-10-03' }),
            expense({ amountCents: 500, date: '2026-09-10' }),
        ]);

        expect(changeLine().textContent).toBe(
            `↑${t('charts.vsPreviousSoFar', { change: percent(1), current: SO_FAR, period: SAME_DAYS })}`
        );
    });

    it('counts your part of a restaurant card expense on the day it was made', async () => {
        await open([
            expense({
                amountCents: 4000,
                personalCents: 1000,
                date: '2026-10-12',
                payment: 'voucher',
                chargeDate: '2026-11-12',
            }),
            expense({
                amountCents: 3000,
                personalCents: 500,
                date: '2026-09-20',
                payment: 'voucher',
                chargeDate: '2026-10-20',
            }),
        ]);

        expect(totalLine().textContent).toContain('€10.00');
        expect(changeLine().textContent).toBe(
            `↑${t('charts.vsPreviousSoFar', { change: percent(1), current: SO_FAR, period: SAME_DAYS })}`
        );
    });

    it('shows a fall with the arrow down and the sign', async () => {
        await open([
            expense({ amountCents: 500, date: '2026-10-05' }),
            expense({ amountCents: 1000, date: '2026-09-15' }),
        ]);

        expect(changeLine().textContent).toBe(
            `↓${t('charts.vsPreviousSoFar', { change: percent(-0.5), current: SO_FAR, period: SAME_DAYS })}`
        );
    });

    it('shows no arrow when nothing changed', async () => {
        await open([
            expense({ amountCents: 500, date: '2026-10-05' }),
            expense({ amountCents: 500, date: '2026-09-15' }),
        ]);

        expect(changeLine().textContent).toBe(
            t('charts.vsPreviousSoFar', { change: percent(0), current: SO_FAR, period: SAME_DAYS })
        );
        expect(changeLine().querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('says when there is nothing to compare with, and which days it looked at', async () => {
        await open();

        pick(en.categories.leisure);

        expect(changeLine().textContent).toBe(t('charts.noPreviousSoFar', { current: SO_FAR, period: SAME_DAYS }));
        expect(changeLine().querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('gives the year of a span that is not this one, and names a whole month as a month', async () => {
        await open();

        dates('2026-01-01', '2026-01-31');

        expect(changeLine().textContent).toBe(
            t('charts.noPrevious', { period: monthsOf(new Date(2025, 11, 1), new Date(2025, 11, 31)) })
        );

        dates('2025-12-10', '2025-12-20');

        expect(changeLine().textContent).toBe(
            t('charts.noPrevious', {
                period: period(new Date(2025, 10, 29), new Date(2025, 11, 9), {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                }),
            })
        );
    });

    it('has no change line for a range that starts after today', async () => {
        await open();

        dates('2026-11-01', '2026-11-30');

        expect(totalLine().nextElementSibling).toBeNull();
    });

    it('is not there when the dates are refused', async () => {
        await open();

        dates('2026-10-25', '2026-10-24');

        expect(document.querySelector('.spending-stats__total')).toBeNull();
        expect(document.querySelector('.spending-stats')).toBeNull();
    });

    it('stays for a range too long to draw', async () => {
        await open();

        dates('2020-01-01', '2026-10-31');

        const withYear = { month: 'short', day: 'numeric', year: 'numeric' } as const;
        expect(changeLine().textContent).toBe(
            t('charts.noPreviousSoFar', {
                current: period(new Date(2020, 0, 1), new Date(2026, 9, 25), withYear),
                period: period(new Date(2013, 2, 1), new Date(2019, 11, 25), withYear),
            })
        );
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

    it('starts the weeks where the browser does', async () => {
        stubLanguages(['en-US']);
        await open();

        groupBy(text.group.week);

        expect(rows()).toHaveLength(12);
        expect(rows()[0]!.textContent).toContain(weekOf('Aug 9'));
        expect(rows().at(-1)!.textContent).toContain(weekOf('Oct 25'));
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

    it('sets each category in a notched card with no bar of its own', async () => {
        await open();

        for (const row of breakdown()) {
            expect(row.classList.contains('card')).toBe(true);
            expect(row.querySelector('[style]')).toBeNull();
        }
    });

    it('draws one strip over the rows, a segment per category as wide as its share, the biggest first', async () => {
        await open();

        const strip = document.querySelector('.category-split__strip')!;
        const segments = [...strip.querySelectorAll<HTMLElement>('.category-split__segment')];
        const startOf = (element: HTMLElement) => Number(element.style.getPropertyValue('--start'));
        expect(strip.compareDocumentPosition(screen.getByRole('list', { name: text.byCategory }))).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING
        );
        expect(segments).toHaveLength(3);
        expect(segments.map(shareOf)).toEqual([
            expect.closeTo(4599 / 8949, 5),
            expect.closeTo(2800 / 8949, 5),
            expect.closeTo(1550 / 8949, 5),
        ]);
        expect(segments.map(startOf)).toEqual([0, expect.closeTo(4599 / 8949, 5), expect.closeTo(7399 / 8949, 5)]);
    });

    it('parts the segments with gaps where one ends and the next begins', async () => {
        await open();

        const gaps = [...document.querySelectorAll<HTMLElement>('.category-split__gap')];
        expect(gaps.map((gap) => Number(gap.style.getPropertyValue('--start')))).toEqual([
            expect.closeTo(4599 / 8949, 5),
            expect.closeTo(7399 / 8949, 5),
        ]);
    });

    it('hides the strip from assistive technology, since the rows carry the numbers', async () => {
        await open();

        expect(document.querySelector('.category-split__strip')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('paints each segment in the color of its category, the same as its icon', async () => {
        await open();

        const segments = [...document.querySelectorAll('.category-split__segment')];
        expect(segments.map((segment) => segment.className)).toEqual([
            'category-split__segment category-split__segment--green',
            'category-split__segment category-split__segment--purple',
            'category-split__segment category-split__segment--vermillion',
        ]);
        expect(breakdown()[0]!.querySelector('.category-badge--green')).not.toBeNull();
        expect(breakdown()[1]!.querySelector('.category-badge--purple')).not.toBeNull();
    });

    it('keeps the gaps in the page color', async () => {
        await open();

        for (const gap of document.querySelectorAll('.category-split__gap')) {
            expect(gap.getAttribute('class')).toBe('category-split__gap');
        }
    });

    it('paints a deleted category as the fallback, in gray', async () => {
        await open([expense({ categoryId: crypto.randomUUID(), amountCents: 300 })]);

        const [segment] = document.querySelectorAll('.category-split__segment');
        expect(segment!.classList.contains('category-split__segment--gray')).toBe(true);
    });

    it('is one whole segment for a single category', async () => {
        await open([expense({ amountCents: 900 })]);

        const segments = [...document.querySelectorAll('.category-split__segment')];
        expect(segments.map(shareOf)).toEqual([1]);
        expect(document.querySelectorAll('.category-split__gap')).toHaveLength(0);
    });

    it('draws a segment for a category that took about one percent', async () => {
        await open([expense({ amountCents: 9900 }), expense({ categoryId: 'leisure', amountCents: 100 })]);

        const segments = [...document.querySelectorAll('.category-split__segment')];
        expect(segments.map(shareOf)).toEqual([expect.closeTo(0.99, 5), expect.closeTo(0.01, 5)]);
        expect(breakdown()[1]!.textContent).toContain('1%');
    });

    it('says nothing was spent when the only expense has none of it as yours', async () => {
        await open([
            expense({
                amountCents: 1000,
                personalCents: 0,
                date: '2026-10-12',
                payment: 'voucher',
                chargeDate: '2026-11-12',
            }),
        ]);

        expect(screen.getByText(text.empty)).toBeTruthy();
        expect(document.querySelector('.category-split')).toBeNull();
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
        expect(document.querySelector('.category-split__strip')).toBeNull();
        expect(screen.getByText(text.empty).classList.contains('notice--quiet')).toBe(true);
    });

    it('does not say it is empty when something was spent', async () => {
        await open();

        expect(screen.queryByText(text.empty)).toBeNull();
    });
});

describe('picking a category from the split', () => {
    it('has no list of categories among the filters', async () => {
        await open();

        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.getByText(text.pickHint)).toBeDefined();
    });

    it('makes each row of the split a toggle, none pressed at first', async () => {
        await open();

        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('false');
        expect(splitRow(en.categories.groceries).getAttribute('aria-pressed')).toBe('false');
    });

    it('narrows the bars and the total to the category pressed, and names it', async () => {
        await open();

        pick(en.categories.food);

        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('true');
        expect(rowOf('Oct 25').textContent).toContain('€3.00');
        expect(rowOf('Oct 24').textContent).toContain('€12.50');
        const total = screen.getByText(t('charts.totalIn', { category: en.categories.food })).closest('p')!;
        expect(total.textContent).toContain('€15.50');
    });

    it('lets go of the category when its row is pressed again', async () => {
        await open();

        pick(en.categories.food);
        pick(en.categories.food);

        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('false');
        expect(totalLine().textContent).toContain('€89.49');
    });

    it('moves to another category when another row is pressed', async () => {
        await open();

        pick(en.categories.food);
        pick(en.categories.leisure);

        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('false');
        expect(splitRow(en.categories.leisure).getAttribute('aria-pressed')).toBe('true');
        expect(
            screen.getByText(t('charts.totalIn', { category: en.categories.leisure })).closest('p')!.textContent
        ).toContain('€28.00');
    });

    it('leaves the split by category alone', async () => {
        await open();

        pick(en.categories.food);

        expect(breakdown()).toHaveLength(3);
    });

    it('keeps the picked category at zero, last, when the new range has none of it, so it can be let go of', async () => {
        await open();
        pick(en.categories.leisure);

        dates('2026-10-24', '2026-10-25');

        expect(breakdown()).toHaveLength(3);
        expect(breakdown().at(-1)!.textContent).toContain(en.categories.leisure);
        expect(breakdown().at(-1)!.textContent).toContain('€0.00');
        expect(document.querySelectorAll('.category-split__segment')).toHaveLength(2);

        pick(en.categories.leisure);

        expect(breakdown()).toHaveLength(2);
    });

    it('keeps the picked category when nothing at all was spent in the new range', async () => {
        await open();
        pick(en.categories.food);

        dates('2026-10-11', '2026-10-12');

        expect(screen.getByText(text.empty)).toBeDefined();
        expect(breakdown()).toHaveLength(1);
        expect(splitRow(en.categories.food).getAttribute('aria-pressed')).toBe('true');
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
        expect(totalLine().textContent).toContain('€61.49');
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
        expect(document.querySelector('.spending-stats__total')).toBeNull();
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
        expect(totalLine().textContent).toContain('€96.49');
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

        expect(screen.getByText(/dom, 25 oct/)).toBeDefined();
        fireEvent.click(screen.getByRole('radio', { name: es.charts.group.week }));
        expect(screen.getAllByText(tEs('charts.weekOf', { date: '19 oct' })).length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole('radio', { name: es.charts.group.month }));
        expect(screen.getAllByText(/octubre de 2026/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(formatAmount(8949, 'EUR', 'es').replace(/\s/g, ' ')).length).toBeGreaterThan(0);
    });

    it('reads a column and the change the Spanish way', async () => {
        stubApi(createFakeApi({ expenses: [...EXPENSES, expense({ amountCents: 700, date: '2026-09-10' })] }).handler);
        renderApp({ path: '/charts' });
        await screen.findByRole('heading', { name: es.charts.title });
        await waitFor(() => expect(slots()[24]).toBeDefined());

        fireEvent.click(slots()[24]!);

        expect(readout().textContent).toBe(
            tEs('charts.readout', { label: 'dom, 25 oct', amount: formatAmount(4899, 'EUR', 'es') })
        );
        const days = new Intl.DateTimeFormat('es', { month: 'short', day: 'numeric' });
        expect(changeLine().textContent).toBe(
            `↑${tEs('charts.vsPreviousSoFar', {
                change: new Intl.NumberFormat('es', {
                    style: 'percent',
                    maximumFractionDigits: 0,
                    signDisplay: 'exceptZero',
                }).format(8249 / 700),
                current: days.formatRange(new Date(2026, 9, 1), new Date(2026, 9, 25)),
                period: days.formatRange(new Date(2026, 8, 1), new Date(2026, 8, 25)),
            })}`
        );
    });
});

describe('your part of the shared expenses', () => {
    it('is in the columns and the total on the day it was made, and a settlement is not', async () => {
        const ana = person('Ana', { role: 'owner' });
        const bea = person('Bea');
        const group = sampleGroup({ members: [ana, bea], me: ana.id });
        await open([], {
            groups: [group],
            entries: [
                sampleEntry(group, { paidBy: bea.id, date: '2026-10-24', payment: 'credit', chargeDate: '2026-11-02' }),
                sampleSettlement(group, ana.id, bea.id, 2000),
            ],
        });

        await waitFor(() => expect(rowOf('Oct 24').textContent).toContain('€20.00'));
        expect(totalLine().textContent).toContain('€20.00');
    });
});

describe('the expenses the chart counts', () => {
    function section() {
        return screen.getByRole('heading', { name: text.expensesTitle, level: 2 }).closest('section')!;
    }

    function tickets() {
        return [...section().querySelectorAll('.sheet')].map((sheet) => ({
            label: sheet.querySelector('h3')!.textContent,
            rows: [...sheet.querySelectorAll('li')].map((row) => row.textContent),
            total: sheet.querySelector('.counted-expenses__subtotal')!.textContent,
        }));
    }

    it('lists them under the chart on a ticket per row, newest first, each adding up to its column', async () => {
        await open();

        expect(tickets().map((ticket) => [ticket.label, ticket.total])).toEqual([
            ['Sun, Oct 25', '€48.99'],
            ['Sat, Oct 24', '€12.50'],
            ['Sat, Oct 10', '€20.00'],
            ['Fri, Oct 2', '€8.00'],
        ]);
        expect(rowOf('Oct 25').textContent).toContain('€48.99');
        expect(tickets()[0]!.rows).toHaveLength(2);
    });

    it('lists a credit card expense on the day it is charged, saying the day it was made', async () => {
        await open();

        const credit = tickets().find((ticket) => ticket.label === 'Fri, Oct 2')!;
        expect(credit.rows[0]).toContain('Sep 20');
        expect(credit.rows[0]).toContain('€8.00');
    });

    it('lists only the category picked', async () => {
        await open();

        pick(en.categories.food);

        expect(tickets().map((ticket) => ticket.total)).toEqual(['€3.00', '€12.50']);
    });

    it('groups them by week and by month, saying the day each was made', async () => {
        await open();

        groupBy(text.group.month);

        expect(tickets().map((ticket) => ticket.label)).toEqual(['October 2026', 'September 2026']);
        expect(tickets()[1]!.rows[0]).toContain('Sep 30');
    });

    it('shows a part of a plan as the part it is', async () => {
        const plan = { id: crypto.randomUUID(), part: 3, parts: 12 };
        await open([
            expense({
                text: 'Laptop',
                amountCents: 4000,
                date: '2026-10-05',
                payment: 'credit',
                chargeDate: '2026-10-05',
                plan,
            }),
        ]);

        expect(tickets()[0]!.rows[0]).toContain(t('expenses.list.part', { part: 3, parts: 12 }));
    });

    it('opens nothing: the rows only read', async () => {
        await open();

        expect(within(section()).queryAllByRole('button')).toHaveLength(0);
    });

    it('lists your part of a shared expense with its group, and never a settlement', async () => {
        const ana = person('Ana', { role: 'owner' });
        const bea = person('Bea');
        const group = sampleGroup({ members: [ana, bea], me: ana.id });
        await open([], {
            groups: [group],
            entries: [
                sampleEntry(group, { paidBy: bea.id, date: '2026-10-24' }),
                sampleSettlement(group, ana.id, bea.id, 2000),
            ],
        });

        await waitFor(() => expect(tickets()).toHaveLength(1));
        expect(tickets()[0]!.rows).toHaveLength(1);
        expect(tickets()[0]!.rows[0]).toContain(group.name);
    });

    it('draws a hundred rows, and Show more brings the next ones and takes the focus to the first of them', async () => {
        await open(
            Array.from({ length: 130 }, (_, index) =>
                expense({ amountCents: 100, date: '2026-10-20', createdAt: 1_000 + index, text: `Item ${index}` })
            )
        );

        expect(tickets()[0]!.rows).toHaveLength(100);
        expect(tickets()[0]!.total).toBe('€130.00');

        fireEvent.click(within(section()).getByRole('button', { name: text.showMore }));

        expect(tickets()[0]!.rows).toHaveLength(130);
        expect(document.activeElement!.textContent).toContain('Item 29');
        expect(within(section()).queryByRole('button', { name: text.showMore })).toBeNull();
    });

    it('is not there when nothing was spent or the dates are refused', async () => {
        await open();

        dates('2026-10-11', '2026-10-12');
        expect(screen.queryByRole('heading', { name: text.expensesTitle })).toBeNull();

        dates('2026-10-25', '2026-10-24');
        expect(screen.queryByRole('heading', { name: text.expensesTitle })).toBeNull();
    });
});
