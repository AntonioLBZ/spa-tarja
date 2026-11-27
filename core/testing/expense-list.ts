import { FALLBACK_CATEGORY_ID } from '@core/categories/categories';
import { NO_FILTERS, buildList, type ListContext, type ListFilters, type ListGrouping } from '@core/lists/expense-list';

import type { Expense } from '@core/expenses/expense';

const expense = (id: string, overrides: Partial<Expense> = {}): Expense => {
    return {
        id,
        categoryId: 'food',
        text: id,
        amountCents: 100,
        currency: 'EUR',
        date: '2026-10-25',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        ...overrides,
    };
};

const plan = (id: string, parts: number, overrides: Partial<Expense> = {}): Expense[] => {
    return Array.from({ length: parts }, (_, index) =>
        expense(`${id}-${index + 1}`, {
            text: id,
            amountCents: 500,
            payment: 'direct',
            chargeDate: `2026-${String(10 + index)}-25`,
            plan: { id, part: index + 1, parts },
            ...overrides,
        })
    );
};

const NAMES: Record<string, string> = {
    food: 'Food',
    groceries: 'Groceries',
    leisure: 'Leisure',
    other: 'Other',
    custom: 'Coffee shops',
};

const ctx: ListContext = {
    categoryOf: (id) => (id in NAMES ? id : FALLBACK_CATEGORY_ID),
    labelOf: (id) => NAMES[id] ?? NAMES[FALLBACK_CATEGORY_ID]!,
    groupNameOf: () => '',
};

const filters = (overrides: Partial<ListFilters>): ListFilters => {
    return { ...NO_FILTERS, ...overrides };
};

const ids = (expenses: readonly Expense[], overrides: Partial<ListFilters> = {}, grouping: ListGrouping = 'day') => {
    return buildList(expenses, filters(overrides), grouping, ctx).flatMap((group) =>
        group.items.map((item) => (item.kind === 'plan' ? item.planId : item.expense.id))
    );
};

export { ctx, expense, filters, ids, NAMES, plan };
