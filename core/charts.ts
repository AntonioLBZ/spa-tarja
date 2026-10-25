import { countedOn } from './counting';
import { addDays, addMonths, startOfWeek } from './date';
import { monthOf, shiftMonth } from './month';

import type { Expense } from './expense';

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

// What counts inside the range on the day each expense is charged (`countedOn`), deleted ones left out
function inRange(expenses: readonly Expense[], range: Range): Expense[] {
    return expenses.filter((expense) => {
        const day = countedOn(expense);
        return expense.deletedAt === null && day >= range.from && day <= range.to;
    });
}

// Spending over time: a bucket for each day, week or month of the range, empty ones included, oldest first. The first
// bucket starts where its week or month does, whatever day the range begins on.
function spendingBuckets(
    expenses: readonly Expense[],
    options: { granularity: Granularity; range: Range; categoryId: string | null }
): Bucket[] {
    const { granularity, range, categoryId } = options;
    if (range.from > range.to) return [];

    const totals = new Map<string, number>();
    for (const expense of inRange(expenses, range)) {
        if (categoryId !== null && expense.categoryId !== categoryId) continue;
        const start = bucketStart(countedOn(expense), granularity);
        totals.set(start, (totals.get(start) ?? 0) + expense.amountCents);
    }

    const buckets: Bucket[] = [];
    for (let start = bucketStart(range.from, granularity); start <= range.to; start = nextBucket(start, granularity)) {
        buckets.push({ start, totalCents: totals.get(start) ?? 0 });
    }
    return buckets;
}

// What each category took in the range, the biggest first and by name when they tie
function categoryTotals(expenses: readonly Expense[], range: Range): CategoryTotal[] {
    const totals = new Map<string, number>();
    for (const expense of inRange(expenses, range)) {
        totals.set(expense.categoryId, (totals.get(expense.categoryId) ?? 0) + expense.amountCents);
    }
    return [...totals]
        .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
        .sort((a, b) => b.totalCents - a.totalCents || a.categoryId.localeCompare(b.categoryId));
}

// What a chart shows before anyone picks dates: this month for days, twelve weeks or twelve months counting this one
function defaultRange(granularity: Granularity, today: string): Range {
    if (granularity === 'day') return { from: `${monthOf(today)}-01`, to: today };
    if (granularity === 'week') return { from: addDays(startOfWeek(today), -7 * 11), to: today };
    return { from: `${shiftMonth(monthOf(today), -11)}-01`, to: today };
}

export { GRANULARITIES, bucketStart, categoryTotals, defaultRange, spendingBuckets };
export type { Bucket, CategoryTotal, Granularity, Range };
