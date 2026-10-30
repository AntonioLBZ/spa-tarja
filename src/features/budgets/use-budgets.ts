import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useCategoryOptions } from '@/features/categories/use-category-options';
import { budgetsQuery } from '@/lib/api';
import { TOTAL_SCOPE } from '@core/budget';
import { FALLBACK_CATEGORY_ID } from '@core/categories';

// The limits the person set, with what lets them be read: the scopes that exist (the total, then each category in the
// order of the list) and how an expense is filed, a category that no longer exists reading as the fallback. The rows
// of a scope that doesn't exist are left out.
const useBudgets = () => {
    const { options } = useCategoryOptions();
    const { data, isError } = useQuery(budgetsQuery());

    return useMemo(() => {
        const scopes = [TOTAL_SCOPE, ...options.map((option) => option.id)];
        const known = new Set(scopes);
        return {
            budgets: (data ?? []).filter((row) => known.has(row.scope)),
            scopes,
            categoryOf: (categoryId: string) => (known.has(categoryId) ? categoryId : FALLBACK_CATEGORY_ID),
            // Nothing to show because the server couldn't be asked and this device holds nothing
            isError: isError && data === undefined,
        };
    }, [options, data, isError]);
};

export { useBudgets };
