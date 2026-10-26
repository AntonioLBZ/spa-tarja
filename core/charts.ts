import { countedCents, countedOn } from './counting';
import { addDays, addMonths, daysBetween, endOfMonth, startOfWeek } from './date';
import { monthOf, shiftMonth } from './month';

import type { Expense } from './expense';

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
    // The first day of the bucket: the day, the Monday of the week or the first of the month
    start: string;
    totalCents: number;
}

interface CategoryTotal {
    categoryId: string;
    totalCents: number;
}

function bucketStart(day: string, granularity: Granularity): string {
    if (granularity === 'day') return day;
    if (granularity === 'week') return startOfWeek(day);
    return `${monthOf(day)}-01`;
}

function nextBucket(start: string, granularity: Granularity): string {
    if (granularity === 'day') return addDays(start, 1);
    if (granularity === 'week') return addDays(start, 7);
    return addMonths(start, 1);
}

// How many rows a range makes: the days, the weeks it touches or the months it touches; none when it ends before it begins
function bucketCount(granularity: Granularity, range: Range): number {
    if (range.from > range.to) return 0;
    if (granularity === 'day') return daysBetween(range.from, range.to) + 1;
    if (granularity === 'week') return Math.floor(daysBetween(startOfWeek(range.from), range.to) / 7) + 1;
    const [fromYear = 0, fromMonth = 1] = range.from.split('-').map(Number);
    const [toYear = 0, toMonth = 1] = range.to.split('-').map(Number);
    return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
}

// What counts inside the range on the day each expense counts on (`countedOn`), deleted ones left out
function inRange(expenses: readonly Expense[], range: Range): Expense[] {
    return expenses.filter((expense) => {
        const day = countedOn(expense);
        return expense.deletedAt === null && day >= range.from && day <= range.to;
    });
}

// Spending over time: a bucket for each day, week or month of the range, empty ones included, oldest first. The first
// bucket starts where its week or month does, whatever day the range begins on. A range of more than MAX_BUCKETS, or
// one that ends before it begins, has none.
function spendingBuckets(
    expenses: readonly Expense[],
    options: { granularity: Granularity; range: Range; categoryId: string | null }
): Bucket[] {
    const { granularity, range, categoryId } = options;
    const count = bucketCount(granularity, range);
    if (count === 0 || count > MAX_BUCKETS) return [];

    const totals = new Map<string, number>();
    for (const expense of inRange(expenses, range)) {
        if (categoryId !== null && expense.categoryId !== categoryId) continue;
        const start = bucketStart(countedOn(expense), granularity);
        totals.set(start, (totals.get(start) ?? 0) + countedCents(expense));
    }

    const buckets: Bucket[] = [];
    for (let start = bucketStart(range.from, granularity); start <= range.to; start = nextBucket(start, granularity)) {
        buckets.push({ start, totalCents: totals.get(start) ?? 0 });
    }
    return buckets;
}

// Everything that counts in the range, in one category or in all of them (null), however many rows that would make
function spendingTotal(expenses: readonly Expense[], options: { range: Range; categoryId: string | null }): number {
    const { range, categoryId } = options;
    return inRange(expenses, range)
        .filter((expense) => categoryId === null || expense.categoryId === categoryId)
        .reduce((sum, expense) => sum + countedCents(expense), 0);
}

// What each category took in the range, the biggest first and by name when they tie
function categoryTotals(expenses: readonly Expense[], range: Range): CategoryTotal[] {
    const totals = new Map<string, number>();
    for (const expense of inRange(expenses, range)) {
        totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + countedCents(expense));
    }
    return [...totals]
        .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
        .sort((a, b) => b.totalCents - a.totalCents || a.categoryId.localeCompare(b.categoryId));
}

// What a chart shows before anyone picks dates: this month for days, twelve weeks or twelve months counting this one,
// up to the end of the period so that what is still to be charged in it shows, as it does in the summary
function defaultRange(granularity: Granularity, today: string): Range {
    if (granularity === 'day') return { from: `${monthOf(today)}-01`, to: endOfMonth(today) };
    const monday = startOfWeek(today);
    if (granularity === 'week') return { from: addDays(monday, -7 * 11), to: addDays(monday, 6) };
    return { from: `${shiftMonth(monthOf(today), -11)}-01`, to: endOfMonth(today) };
}

export {
    GRANULARITIES,
    MAX_BUCKETS,
    bucketCount,
    bucketStart,
    categoryTotals,
    defaultRange,
    spendingBuckets,
    spendingTotal,
};
export type { Bucket, CategoryTotal, Granularity, Range };
