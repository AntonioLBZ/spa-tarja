import { addDays, addMonths, daysBetween, endOfMonth, MONDAY, startOfWeek, type WeekDay } from '@core/basics/date';
import { monthOf, shiftMonth } from '@core/basics/month';
import { countedCents, countedOn } from '@core/expenses/counting';

import type { Expense } from '@core/expenses/expense';

// A chart is a list of rows to read: a year of days, with room to spare
const MAX_BUCKETS = 400;

const GRANULARITIES = ['day', 'week', 'month'] as const;

type Granularity = (typeof GRANULARITIES)[number];

// The days from one to the other, both included
interface Range {
    from: string;
    to: string;
}

interface Bucket {
    // The first day of the bucket: the day, the first day of the week or the first of the month
    start: string;
    totalCents: number;
}

interface CategoryTotal {
    categoryId: string;
    totalCents: number;
}

const bucketStart = (day: string, granularity: Granularity, weekStart: WeekDay = MONDAY): string => {
    if (granularity === 'day') return day;
    if (granularity === 'week') return startOfWeek(day, weekStart);
    return `${monthOf(day)}-01`;
};

// The start of the bucket that many buckets later, or earlier when the count is negative
const nextBucket = (start: string, granularity: Granularity, count = 1): string => {
    if (granularity === 'day') return addDays(start, count);
    if (granularity === 'week') return addDays(start, 7 * count);
    return addMonths(start, count);
};

// How many rows a range makes: the days, the weeks it touches or the months it touches; none when it ends before it begins
const bucketCount = (granularity: Granularity, range: Range, weekStart: WeekDay = MONDAY): number => {
    if (range.from > range.to) return 0;
    if (granularity === 'day') return daysBetween(range.from, range.to) + 1;
    if (granularity === 'week') return Math.floor(daysBetween(startOfWeek(range.from, weekStart), range.to) / 7) + 1;
    const [fromYear = 0, fromMonth = 1] = range.from.split('-').map(Number);
    const [toYear = 0, toMonth = 1] = range.to.split('-').map(Number);
    return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
};

// What counts inside the range on the day each expense counts on (`countedOn`), deleted ones left out
const inRange = (expenses: readonly Expense[], range: Range): Expense[] => {
    return expenses.filter((expense) => {
        const day = countedOn(expense);
        return expense.deletedAt === null && day >= range.from && day <= range.to;
    });
};

// Spending over time: a bucket for each day, week or month of the range, empty ones included, oldest first. The first
// bucket starts where its week or month does, whatever day the range begins on. A range of more than MAX_BUCKETS, or
// one that ends before it begins, has none.
const spendingBuckets = (
    expenses: readonly Expense[],
    options: { granularity: Granularity; range: Range; categoryId: string | null; weekStart?: WeekDay }
): Bucket[] => {
    const { granularity, range, categoryId, weekStart = MONDAY } = options;
    const count = bucketCount(granularity, range, weekStart);
    if (count === 0 || count > MAX_BUCKETS) return [];

    const totals = new Map<string, number>();
    for (const expense of inRange(expenses, range)) {
        if (categoryId !== null && expense.categoryId !== categoryId) continue;
        const start = bucketStart(countedOn(expense), granularity, weekStart);
        totals.set(start, (totals.get(start) ?? 0) + countedCents(expense));
    }

    const buckets: Bucket[] = [];
    for (
        let start = bucketStart(range.from, granularity, weekStart);
        start <= range.to;
        start = nextBucket(start, granularity)
    ) {
        buckets.push({ start, totalCents: totals.get(start) ?? 0 });
    }
    return buckets;
};

// Everything that counts in the range, in one category or in all of them (null), however many rows that would make
const spendingTotal = (expenses: readonly Expense[], options: { range: Range; categoryId: string | null }): number => {
    const { range, categoryId } = options;
    return inRange(expenses, range)
        .filter((expense) => categoryId === null || expense.categoryId === categoryId)
        .reduce((sum, expense) => sum + countedCents(expense), 0);
};

// The expenses that make up a row of a chart, and what they add up to: the column of that row
interface CountedGroup {
    // The first day of the row
    start: string;
    totalCents: number;
    expenses: Expense[];
}

// What the chart counts, expense by expense, in a group for each row that has any: the rows newest first and, inside
// each, the expenses by the day they count on and then the newest made first. Something that counts nothing is left out.
const countedExpenses = (
    expenses: readonly Expense[],
    options: { granularity: Granularity; range: Range; categoryId: string | null; weekStart?: WeekDay }
): CountedGroup[] => {
    const { granularity, range, categoryId, weekStart = MONDAY } = options;
    const counted = inRange(expenses, range)
        .filter((expense) => (categoryId === null || expense.categoryId === categoryId) && countedCents(expense) > 0)
        .sort((a, b) => countedOn(b).localeCompare(countedOn(a)) || b.createdAt - a.createdAt);

    const groups: CountedGroup[] = [];
    for (const expense of counted) {
        const start = bucketStart(countedOn(expense), granularity, weekStart);
        let group = groups.at(-1);
        if (group?.start !== start) {
            group = { start, totalCents: 0, expenses: [] };
            groups.push(group);
        }
        group.totalCents += countedCents(expense);
        group.expenses.push(expense);
    }
    return groups;
};

// What each category took in the range, the biggest first and by name when they tie; one that took nothing is left out
const categoryTotals = (expenses: readonly Expense[], range: Range): CategoryTotal[] => {
    const totals = new Map<string, number>();
    for (const expense of inRange(expenses, range)) {
        totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + countedCents(expense));
    }
    return [...totals]
        .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
        .filter((total) => total.totalCents > 0)
        .sort((a, b) => b.totalCents - a.totalCents || a.categoryId.localeCompare(b.categoryId));
};

// What a chart shows before anyone picks dates: this month for days, twelve weeks or twelve months counting this one,
// up to the end of the period so that what is still to be charged in it shows, as it does in the summary
const defaultRange = (granularity: Granularity, today: string, weekStart: WeekDay = MONDAY): Range => {
    if (granularity === 'day') return { from: `${monthOf(today)}-01`, to: endOfMonth(today) };
    const thisWeek = startOfWeek(today, weekStart);
    if (granularity === 'week') return { from: addDays(thisWeek, -7 * 11), to: addDays(thisWeek, 6) };
    return { from: `${shiftMonth(monthOf(today), -11)}-01`, to: endOfMonth(today) };
};

// The span of a range and the earlier one it is compared with, both from their start up to the same point
interface Comparison {
    current: Range;
    previous: Range;
}

// How many calendar months a range of whole months spans; null for any other range
const wholeMonths = (range: Range): number | null => {
    if (!range.from.endsWith('-01') || range.to !== endOfMonth(range.to)) return null;
    const index = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7));
    return index(range.to) - index(range.from) + 1;
};

// The same span of the calendar right before a range: September for October, the twelve months before twelve months,
// and as many days before any other range, so whole weeks go back whole weeks
const previousRange = (range: Range): Range => {
    const months = wholeMonths(range);
    const from =
        months === null
            ? addDays(range.from, -(daysBetween(range.from, range.to) + 1))
            : addMonths(range.from, -months);
    return { from, to: addDays(range.from, -1) };
};

// What the total of a range is compared with: the same span of the calendar right before it (ADR-0043). A range still
// running is compared from its start up to today, and the earlier span up to the same point: the same day of the month
// (or the last one of a shorter month) for months, as many days in for any other. One that hasn't started, or that ends
// before it begins, has nothing to compare.
const comparison = (range: Range, today: string): Comparison | null => {
    if (range.from > range.to || range.from > today) return null;
    const previous = previousRange(range);
    if (range.to <= today) return { current: range, previous };

    const months = wholeMonths(range);
    const sameDay =
        months === null ? addDays(previous.from, daysBetween(range.from, today)) : addMonths(today, -months);
    return {
        current: { from: range.from, to: today },
        previous: { from: previous.from, to: sameDay < previous.to ? sameDay : previous.to },
    };
};

interface Scale {
    max: number;
    step: number;
    // From 0 to max, `step` apart
    ticks: number[];
}

// The round steps of a scale, in cents: 1, 2, 2.5 and 5 times a power of ten that leave whole cents
const STEP_MANTISSAS = [1, 2, 2.5, 5];

// A round scale for values up to `maxCents`: 2 to 4 equal steps, the lowest top that holds the value and, of the steps
// that reach it, the smallest. Nothing to show, or what isn't a finite amount, gets the scale of one euro.
const niceScale = (maxCents: number): Scale => {
    const value = Number.isFinite(maxCents) && maxCents > 0 ? Math.ceil(maxCents) : 100;
    let best = { max: Infinity, step: 0 };

    for (let power = 1; power <= value; power *= 10) {
        for (const mantissa of STEP_MANTISSAS) {
            const step = mantissa * power;
            if (!Number.isInteger(step)) continue;
            const steps = Math.max(2, Math.ceil(value / step));
            const max = steps * step;
            if (steps <= 4 && (max < best.max || (max === best.max && step < best.step))) best = { max, step };
        }
    }

    const ticks = Array.from({ length: best.max / best.step + 1 }, (_, index) => index * best.step);
    return { ...best, ticks };
};

export {
    GRANULARITIES,
    MAX_BUCKETS,
    bucketCount,
    bucketStart,
    categoryTotals,
    comparison,
    countedExpenses,
    defaultRange,
    niceScale,
    previousRange,
    spendingBuckets,
    spendingTotal,
    type Bucket,
    type CategoryTotal,
    type CountedGroup,
    type Granularity,
    type Range,
};
