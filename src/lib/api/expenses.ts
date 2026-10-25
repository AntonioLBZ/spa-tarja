import { queryOptions } from '@tanstack/react-query';

import { api } from './client';

import type { Expense } from '@core/expense';

// Every expense of the user, deleted ones included, and the cursor to ask for what changes next
interface ExpensesState {
    expenses: Expense[];
    cursor: number;
}

const EXPENSES_KEY = ['expenses'] as const;

async function loadExpenses(): Promise<ExpensesState> {
    const expenses: Expense[] = [];
    let cursor = 0;

    for (;;) {
        const response = await api.api.expenses.$get({ query: { after: String(cursor) } });
        if (!response.ok) throw new Error(`Loading expenses failed: ${response.status}`);
        const page = await response.json();
        expenses.push(...page.expenses);
        cursor = page.cursor;
        if (!page.hasMore) return { expenses, cursor };
    }
}

function expensesQuery() {
    return queryOptions({ queryKey: EXPENSES_KEY, queryFn: loadExpenses });
}

// Creates or updates by id, so sending it twice is harmless
async function putExpense(expense: Expense): Promise<Expense> {
    const { id, ...body } = expense;
    const response = await api.api.expenses[':id'].$put({ param: { id }, json: body });
    if (!response.ok) throw new Error(`Saving the expense failed: ${response.status}`);
    return response.json();
}

function upsertExpense(state: ExpensesState, expense: Expense): ExpensesState {
    const exists = state.expenses.some((item) => item.id === expense.id);
    const expenses = exists
        ? state.expenses.map((item) => (item.id === expense.id ? expense : item))
        : [...state.expenses, expense];
    return { ...state, expenses };
}

export { EXPENSES_KEY, expensesQuery, putExpense, upsertExpense };
export type { ExpensesState };
