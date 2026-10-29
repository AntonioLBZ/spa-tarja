import { ApiError, toApiError } from './api-error';
import { api } from './client';

import type { Budget, BudgetLimitsInput } from '@core/budget';

const BUDGETS_KEY = ['budgets'] as const;

async function fetchBudgets(): Promise<Budget[]> {
    const response = await api.api.budgets.$get();
    if (!response.ok) throw new ApiError(response.status);
    return (await response.json()).budgets;
}

// Sets the limits of a month, replacing what those scopes had, so sending it twice is harmless
async function putBudgets(month: string, input: BudgetLimitsInput): Promise<Budget[]> {
    const response = await api.api.budgets[':month'].$put({ param: { month }, json: input });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()).budgets;
}

export { BUDGETS_KEY, fetchBudgets, putBudgets };
