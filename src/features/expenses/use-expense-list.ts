import { useDeferredValue, useMemo, useState } from 'react';

import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useGroupTitles } from '@/features/groups/use-group-options';
import { useGroups } from '@/features/groups/use-ledgers';
import { useFadeOut } from '@/lib/use-fade-out';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import { toDateString } from '@core/date';
import {
    NO_FILTERS,
    activeFilterCount,
    filtersAfterAdding,
    groupItems,
    hasFilters,
    limitRows,
    listItems,
    openingFilters,
    shownExpense,
} from '@core/expense-list';

import { useAddForm } from './add-form-state';
import { readStoredGrouping, storeGrouping } from './list-grouping';
import { useYourExpenses } from './use-your-expenses';

import type { Expense } from '@core/expense';
import type { ListContext, ListFilters, ListGrouping } from '@core/expense-list';

// How many rows the list draws, and how many more each "Show more" adds
const PAGE_SIZE = 100;

// The expenses of the home screen, narrowed by the filters and grouped. The filters are state of the screen; the
// grouping is a stored preference.
const useExpenseList = () => {
    const { expenses, pendingIds, hasData, neverPulled, isError, isWaitingForNetwork, sourceOf } = useYourExpenses();
    const { options, labelOf } = useCategoryOptions();
    const { groups: sharedGroups } = useGroups();
    const titles = useGroupTitles(sharedGroups);
    const { added } = useAddForm();

    // What the list opened on, which does not count as a filter in use
    const [opening] = useState(() => openingFilters(toDateString(new Date())));
    const [filters, setFilters] = useState<ListFilters>(opening);
    const [grouping, setGrouping] = useState<ListGrouping>(readStoredGrouping);
    const [limit, setLimit] = useState(PAGE_SIZE);

    // Expenses deleted a moment ago, kept on screen until their fade-out is over
    const { leaving, fadeOut } = useFadeOut<Expense>();

    const items = useMemo(() => {
        if (leaving.size === 0) return listItems(expenses);
        const liveIds = new Set(expenses.filter((expense) => expense.deletedAt === null).map((expense) => expense.id));
        return listItems([...expenses, ...[...leaving.values()].filter((expense) => !liveIds.has(expense.id))]);
    }, [expenses, leaving]);

    const known = useMemo(() => new Set(options.map((option) => option.id)), [options]);
    const context = useMemo<ListContext>(
        () => ({
            categoryOf: (categoryId) => (known.has(categoryId) ? categoryId : FALLBACK_CATEGORY_ID),
            labelOf,
            groupNameOf: (groupId) => titles.get(groupId) ?? '',
            searchTexts: new WeakMap<Expense, string>(),
        }),
        [known, labelOf, titles]
    );

    const query = useDeferredValue(filters.query);
    const applied = useMemo(() => ({ ...filters, query }), [filters, query]);
    const groups = useMemo(() => groupItems(items, applied, grouping, context), [items, applied, grouping, context]);
    const shown = useMemo(() => groups.reduce((sum, group) => sum + group.items.length, 0), [groups]);
    const drawn = useMemo(() => limitRows(groups, limit), [groups, limit]);
    const hiddenRows = shown - drawn.reduce((sum, group) => sum + group.items.length, 0);

    // Whether the groups' days, weeks or months go over a New Year
    const spansYears =
        grouping !== 'category' && groups.length > 0 && groups[0]!.key.slice(0, 4) !== groups.at(-1)!.key.slice(0, 4);

    // A filter must never hide a new expense: running out of expenses drops them all, and adding one drops all but the
    // dates, which take the month of the new expense when it falls outside the ones the list opens on
    const [seenAdded, setSeenAdded] = useState(added);
    if (hasData && items.length === 0 && filters !== NO_FILTERS) {
        setFilters(NO_FILTERS);
        setLimit(PAGE_SIZE);
    }
    if (added !== seenAdded) {
        setSeenAdded(added);
        if (added) setFilters(filtersAfterAdding(added.day, toDateString(new Date())));
        setLimit(PAGE_SIZE);
    }

    const changeFilters = (patch: Partial<ListFilters>) => {
        setFilters((current) => ({ ...current, ...patch }));
        setLimit(PAGE_SIZE);
    };

    const clearFilters = () => {
        setFilters(NO_FILTERS);
        setLimit(PAGE_SIZE);
    };

    const changeGrouping = (next: ListGrouping) => {
        setGrouping(next);
        storeGrouping(next);
        setLimit(PAGE_SIZE);
    };

    // Adds a page of rows and says which expense its first new row shows, for the focus to go there
    const showMore = (): string | null => {
        const next = groups.flatMap((group) => group.items)[shown - hiddenRows];
        setLimit((current) => current + PAGE_SIZE);
        return next ? shownExpense(next).id : null;
    };

    return {
        // The groups to draw, cut at the limit, and how many rows that leaves out
        groups: drawn,
        hiddenRows,
        // The rows that pass the filters, and all of them
        shown,
        total: items.length,
        spansYears,
        filters,
        filtering: hasFilters(applied, opening),
        filterCount: activeFilterCount(filters, opening),
        grouping,
        leaving,
        pendingIds,
        // The group and the entry of a shared row, and the name the list gives the group
        sourceOf,
        groupNameOf: context.groupNameOf,
        hasData,
        neverPulled,
        isError,
        isWaitingForNetwork,
        changeFilters,
        clearFilters,
        changeGrouping,
        showMore,
        // Keeps the expenses on screen for the length of the fade-out that deleting them starts
        fadeOut,
    };
};

export { useExpenseList };
