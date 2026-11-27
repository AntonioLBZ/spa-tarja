import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import {
    changeLine,
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
    slots,
    t,
    text,
    totalLine,
    weekOf,
} from '@/lib/testing/charts';
import { stubLanguages } from '@/lib/testing/languages';

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
