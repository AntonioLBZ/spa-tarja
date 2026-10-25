import { queryOptions } from '@tanstack/react-query';

import { CATEGORIES_KEY, fetchCategories } from './categories';
import { api } from './client';
import { INCOME_KEY, fetchIncome } from './income';

function healthQuery() {
    return queryOptions({
        queryKey: ['health'],
        queryFn: async () => {
            const response = await api.api.health.$get();
            if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
            return response.json();
        },
    });
}

// The custom categories, kept offline by the persisted cache
function categoriesQuery() {
    return queryOptions({ queryKey: CATEGORIES_KEY, queryFn: fetchCategories });
}

// What the person earns each month, kept offline by the persisted cache
function incomeQuery() {
    return queryOptions({ queryKey: INCOME_KEY, queryFn: fetchIncome });
}

export { categoriesQuery, healthQuery, incomeQuery };
