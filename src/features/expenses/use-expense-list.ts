import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { useCategoryOptions } from '@/features/categories/use-category-options';
import { readDuration } from '@/lib/motion';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import { NO_FILTERS, groupItems, hasFilters, limitRows, listItems } from '@core/expense-list';

import { readStoredGrouping, storeGrouping } from './list-grouping';
import { useExpenses } from './use-expenses';

import type { Expense } from '@core/expense';
import type { ListContext, ListFilters, ListGrouping } from '@core/expense-list';

// How many rows the list draws, and how many more each "Show more" adds
const PAGE_SIZE = 100;

// What the home screen lists: the expenses of the device, narrowed by the filters and grouped. The filters live here, so
// they go when the person leaves the screen; the grouping is a preference and is kept.
function useExpenseList() {
    const { expenses, pendingIds, hasData, isError, isWaitingForNetwork } = useExpenses();
    const { options, labelOf } = useCategoryOptions();

    const [filters, setFilters] = useState<ListFilters>(NO_FILTERS);
    const [grouping, setGrouping] = useState<ListGrouping>(readStoredGrouping);
    const [limit, setLimit] = useState(PAGE_SIZE);

    // Expenses deleted a moment ago, kept on screen until their fade-out is over
    const [leaving, setLeaving] = useState<ReadonlyMap<string, Expense>>(new Map());
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach(clearTimeout);
    }, []);

    // Sorted and collapsed once per change of data; typing only filters and groups
    const items = useMemo(() => {
        if (leaving.size === 0) return listItems(expenses);
        const liveIds = new Set(expenses.filter((expense) => expense.deletedAt === null).map((expense) => expense.id));
        return listItems([...expenses, ...[...leaving.values()].filter((expense) => !liveIds.has(expense.id))]);
    }, [expenses, leaving]);

    const known = useMemo(() => new Set(options.map((option) => option.id)), [options]);
    // The search text of each expense is remembered, and forgotten when the names of the categories change
    const context = useMemo<ListContext>(
        () => ({
            categoryOf: (categoryId) => (known.has(categoryId) ? categoryId : FALLBACK_CATEGORY_ID),
            labelOf,
            searchTexts: new WeakMap<Expense, string>(),
        }),
        [known, labelOf]
    );

    // Typing never waits for the list to be worked out again
    const query = useDeferredValue(filters.query);
    const applied = useMemo(() => ({ ...filters, query }), [filters, query]);
    const groups = useMemo(() => groupItems(items, applied, grouping, context), [items, applied, grouping, context]);
    const shown = useMemo(() => groups.reduce((sum, group) => sum + group.items.length, 0), [groups]);
    const drawn = useMemo(() => limitRows(groups, limit), [groups, limit]);

    // Whether the days or months of the groups go over a New Year, which their labels then say
    const spansYears =
        grouping !== 'category' && groups.length > 0 && groups[0]!.key.slice(0, 4) !== groups.at(-1)!.key.slice(0, 4);

    function changeFilters(patch: Partial<ListFilters>) {
        setFilters((current) => ({ ...current, ...patch }));
        setLimit(PAGE_SIZE);
    }

    function clearFilters() {
        setFilters(NO_FILTERS);
        setLimit(PAGE_SIZE);
    }

    function changeGrouping(next: ListGrouping) {
        setGrouping(next);
        storeGrouping(next);
        setLimit(PAGE_SIZE);
    }

    // Keeps the expenses on screen for the length of the fade-out that deleting them starts
    function fadeOut(deleted: readonly Expense[]) {
        const duration = readDuration('--duration-base');
        if (duration === 0) return;
        setLeaving((current) => new Map([...current, ...deleted.map((expense) => [expense.id, expense] as const)]));
        const timer = setTimeout(() => {
            timers.current.delete(timer);
            setLeaving((current) => {
                const next = new Map(current);
                for (const expense of deleted) next.delete(expense.id);
                return next;
            });
        }, duration);
        timers.current.add(timer);
    }

    return {
        // The groups to draw, cut at the limit, and how many rows that leaves out
        groups: drawn,
        hiddenRows: shown - drawn.reduce((sum, group) => sum + group.items.length, 0),
        // The rows that pass the filters, and all of them
        shown,
        total: items.length,
        spansYears,
        filters,
        filtering: hasFilters(applied),
        grouping,
        leaving,
        pendingIds,
        hasData,
        isError,
        isWaitingForNetwork,
        changeFilters,
        clearFilters,
        changeGrouping,
        showMore: () => setLimit((current) => current + PAGE_SIZE),
        fadeOut,
    };
}

export { useExpenseList };
