import { queryOptions } from '@tanstack/react-query';

import { CATEGORIES_KEY, fetchCategories } from './categories';
import { api } from './client';

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

export { categoriesQuery, healthQuery };
