import { ApiError } from './api-error';
import { api } from './client';

import type { Expense } from '@core/expense';

// Every expense this device knows about, deleted ones included, and the cursor of the last change seen
interface ExpensesState {
    expenses: Expense[];
    cursor: number;
}

interface Changes {
    expenses: Expense[];
    cursor: number;
    hasMore: boolean;
}

const EXPENSES_KEY = ['expenses'] as const;

const fetchChanges = async (after: number): Promise<Changes> => {
    const response = await api.api.expenses.$get({ query: { after: String(after) } });
    if (!response.ok) throw new ApiError(response.status);
    return response.json();
};

// Creates or updates by id, so sending it twice is harmless
const putExpense = async (expense: Expense): Promise<Expense> => {
    const { id, ...body } = expense;
    const response = await api.api.expenses[':id'].$put({ param: { id }, json: body });
    if (!response.ok) throw new ApiError(response.status);
    return response.json();
};

export { EXPENSES_KEY, fetchChanges, putExpense, type Changes, type ExpensesState };
