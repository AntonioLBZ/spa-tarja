import { bucketStart } from './charts';
import { countedCents, paymentOf } from './counting';
import { collapsePlans, planTotal, type ListItem } from './installments';
import { normalizeText, searchWords } from './text';

import type { Expense, Payment } from './expense';

const LIST_GROUPINGS = ['day', 'week', 'month', 'category'] as const;

type ListGrouping = (typeof LIST_GROUPINGS)[number];

const DEFAULT_LIST_GROUPING: ListGrouping = 'day';

// How an expense was paid, or `any`; `plan` is the expenses paid in installments
const PAID_WITH = ['any', 'direct', 'credit', 'voucher', 'plan'] as const satisfies readonly (
    Payment | 'any' | 'plan'
)[];

type PaidWith = (typeof PAID_WITH)[number];

interface ListFilters {
    // What was typed in the search
    query: string;
    // The category to keep; empty for all of them
    categoryId: string;
    // The days the expense was made between, both included; empty leaves that end open
    from: string;
    to: string;
    paidWith: PaidWith;
}

const NO_FILTERS: ListFilters = { query: '', categoryId: '', from: '', to: '', paidWith: 'any' };

interface ListContext {
    // The category an expense files under: its own, or the fallback when that category no longer exists
    categoryOf: (categoryId: string) => string;
    // The name of a category as the list shows it
    labelOf: (categoryId: string) => string;
    // What a search read in each expense, kept between searches. Valid for as long as `labelOf` is.
    searchTexts?: WeakMap<Expense, string>;
}

interface ListGroup {
    // The day, the Monday of the week or the first of the month; the category id when grouped by category
    key: string;
    items: ListItem[];
    // What the rows add up to, a plan once at its full price
    totalCents: number;
}

function isListGrouping(value: unknown): value is ListGrouping {
    return LIST_GROUPINGS.some((grouping) => grouping === value);
}

// The expense a row shows: the expense itself, or the first part present of a plan
function shownExpense(item: ListItem): Expense {
    return item.kind === 'plan' ? item.parts[0]! : item.expense;
}

// What a row adds up to: a plan at its total, a restaurant card expense at your part
function itemCents(item: ListItem): number {
    return item.kind === 'plan' ? planTotal(item.parts) : countedCents(item.expense);
}

function newestFirst(a: Expense, b: Expense): number {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.createdAt - a.createdAt;
}

// The rows of the list before any filter: deleted expenses dropped, the newest day first and, within a day, the
// latest logged first, with the parts of a plan collapsed into one row
function listItems(expenses: readonly Expense[]): ListItem[] {
    return collapsePlans(expenses.filter((expense) => expense.deletedAt === null).toSorted(newestFirst));
}

function searchTextOf(expense: Expense, ctx: ListContext): string {
    const cached = ctx.searchTexts?.get(expense);
    if (cached !== undefined) return cached;
    const text = normalizeText(`${expense.text} ${ctx.labelOf(expense.categoryId)}`);
    ctx.searchTexts?.set(expense, text);
    return text;
}

function paidWithMatches(item: ListItem, paidWith: PaidWith): boolean {
    if (paidWith === 'any') return true;
    if (paidWith === 'plan') return item.kind === 'plan';
    return item.kind === 'single' && paymentOf(item.expense) === paidWith;
}

// Filters are applied to the row as it is shown, by the day it was made
function matcher(filters: ListFilters, ctx: ListContext): (item: ListItem) => boolean {
    const { categoryId, from, to, paidWith } = filters;
    const words = searchWords(filters.query);

    return (item) => {
        const expense = shownExpense(item);
        if (!paidWithMatches(item, paidWith)) return false;
        if (categoryId !== '' && ctx.categoryOf(expense.categoryId) !== categoryId) return false;
        if (from !== '' && expense.date < from) return false;
        if (to !== '' && expense.date > to) return false;
        if (words.length === 0) return true;
        const text = searchTextOf(expense, ctx);
        return words.every((word) => text.includes(word));
    };
}

function keyOf(expense: Expense, grouping: ListGrouping, ctx: ListContext): string {
    if (grouping === 'category') return ctx.categoryOf(expense.categoryId);
    return bucketStart(expense.date, grouping);
}

// The rows that pass the filters, in groups. Days, weeks and months come newest first, categories from the biggest
// subtotal and by id when two tie. The rows keep their order inside a group.
function groupItems(
    items: readonly ListItem[],
    filters: ListFilters,
    grouping: ListGrouping,
    ctx: ListContext
): ListGroup[] {
    const matches = matcher(filters, ctx);
    const groups = new Map<string, ListGroup>();

    for (const item of items) {
        if (!matches(item)) continue;
        const key = keyOf(shownExpense(item), grouping, ctx);
        let group = groups.get(key);
        if (!group) {
            group = { key, items: [], totalCents: 0 };
            groups.set(key, group);
        }
        group.items.push(item);
        group.totalCents += itemCents(item);
    }

    const byKey = (a: ListGroup, b: ListGroup) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    return [...groups.values()].sort(
        grouping === 'category' ? (a, b) => b.totalCents - a.totalCents || byKey(a, b) : (a, b) => byKey(b, a)
    );
}

// What the expense list shows: the expenses the device holds, filtered and grouped. Everything is by the day the
// expense was made, which is not the day it counts on (ARCHITECTURE.md §5).
function buildList(
    expenses: readonly Expense[],
    filters: ListFilters,
    grouping: ListGrouping,
    ctx: ListContext
): ListGroup[] {
    return groupItems(listItems(expenses), filters, grouping, ctx);
}

// The first `max` rows of the groups, in order. A group cut short keeps the subtotal of all its rows.
function limitRows(groups: readonly ListGroup[], max: number): ListGroup[] {
    const limited: ListGroup[] = [];
    let left = max;
    for (const group of groups) {
        if (left <= 0) break;
        limited.push(group.items.length <= left ? group : { ...group, items: group.items.slice(0, left) });
        left -= group.items.length;
    }
    return limited;
}

// How many of the filters of the panel are in use: the category, the dates and how it was paid, one each
function activeFilterCount(filters: ListFilters): number {
    return [filters.categoryId !== '', filters.from !== '' || filters.to !== '', filters.paidWith !== 'any'].filter(
        Boolean
    ).length;
}

// Whether the search or any filter narrows the list
function hasFilters(filters: ListFilters): boolean {
    return searchWords(filters.query).length > 0 || activeFilterCount(filters) > 0;
}

export {
    DEFAULT_LIST_GROUPING,
    LIST_GROUPINGS,
    NO_FILTERS,
    PAID_WITH,
    activeFilterCount,
    buildList,
    groupItems,
    hasFilters,
    isListGrouping,
    limitRows,
    listItems,
    shownExpense,
};
export type { ListContext, ListFilters, ListGroup, ListGrouping };
