import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import {
    breakdown,
    changeLine,
    columns,
    dates,
    expense,
    EXPENSES,
    groupBy,
    open,
    plot,
    readout,
    rowOf,
    rows,
    shareOf,
    slots,
    t,
    table,
    tEs,
    text,
    totalLine,
    weekOf,
} from '@/lib/testing/charts';
import { createFakeApi } from '@/lib/testing/fake-api';
import { stubLanguages } from '@/lib/testing/languages';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { addDays } from '@core/basics/date';
import { formatAmount } from '@core/basics/money';
import { MAX_BUCKETS } from '@core/reports/charts';

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
