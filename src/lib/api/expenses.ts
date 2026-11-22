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

// The most the server answers in a page: a device that starts empty pulls years of expenses in a few requests
const EXPENSES_PAGE_SIZE = 500;

const fetchChanges = async (after: number): Promise<Changes> => {
    const response = await api.api.expenses.$get({
        query: { after: String(after), limit: String(EXPENSES_PAGE_SIZE) },
    });
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
