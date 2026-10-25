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

// The server answered, and the answer wasn't a success; a request that never got an answer throws something else
class ApiError extends Error {
    readonly status: number;

    constructor(status: number) {
        super(`Request failed with status ${status}`);
        this.status = status;
    }
}

async function fetchChanges(after: number): Promise<Changes> {
    const response = await api.api.expenses.$get({ query: { after: String(after) } });
    if (!response.ok) throw new ApiError(response.status);
    return response.json();
}

// Creates or updates by id, so sending it twice is harmless
async function putExpense(expense: Expense): Promise<Expense> {
    const { id, ...body } = expense;
    const response = await api.api.expenses[':id'].$put({ param: { id }, json: body });
    if (!response.ok) throw new ApiError(response.status);
    return response.json();
}

export { ApiError, EXPENSES_KEY, fetchChanges, putExpense };
export type { Changes, ExpensesState };
