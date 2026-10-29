import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BUDGETS_KEY, putBudgets } from '@/lib/api';

import type { Budget, BudgetLimitsInput } from '@core/budget';

// Waits for the server and then puts its answer in the cache, so the months never need a refetch
function useBudgetActions() {
    const queryClient = useQueryClient();

    return useMemo(
        () => ({
            async save(month: string, input: BudgetLimitsInput) {
                const saved = await putBudgets(month, input);
                queryClient.setQueryData<Budget[]>(BUDGETS_KEY, (list = []) => [
                    ...list.filter(
                        (row) => !saved.some((item) => item.month === row.month && item.scope === row.scope)
                    ),
                    ...saved,
                ]);
            },
        }),
        [queryClient]
    );
}

export { useBudgetActions };
