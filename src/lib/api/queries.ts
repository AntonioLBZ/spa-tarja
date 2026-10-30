import { queryOptions } from '@tanstack/react-query';

import { BUDGETS_KEY, fetchBudgets } from './budgets';
import { CATEGORIES_KEY, fetchCategories } from './categories';
import { api } from './client';
import { INCOME_KEY, fetchIncome } from './income';

const healthQuery = () => {
    return queryOptions({
        queryKey: ['health'],
        queryFn: async () => {
            const response = await api.api.health.$get();
            if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
            return response.json();
        },
    });
};

// The custom categories, kept offline by the persisted cache
const categoriesQuery = () => {
    return queryOptions({ queryKey: CATEGORIES_KEY, queryFn: fetchCategories });
};

// What the person earns each month, kept offline by the persisted cache
const incomeQuery = () => {
    return queryOptions({ queryKey: INCOME_KEY, queryFn: fetchIncome });
};

// The limits each month sets, kept offline by the persisted cache
const budgetsQuery = () => {
    return queryOptions({ queryKey: BUDGETS_KEY, queryFn: fetchBudgets });
};

export { budgetsQuery, categoriesQuery, healthQuery, incomeQuery };
