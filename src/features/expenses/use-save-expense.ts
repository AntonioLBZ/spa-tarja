import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { EXPENSES_KEY } from '@/lib/api';
import { useOutbox } from '@/lib/offline';

import type { Expense } from '@core/expense';

// Saving never waits for the network: the expense is safe on the device once this resolves, and so are all of them when
// given several (the parts of a plan). It rejects only when the device can't store it.
function useSaveExpense() {
    const outbox = useOutbox();
    const queryClient = useQueryClient();

    return useCallback(
        async (expense: Expense | readonly Expense[]) => {
            if (Array.isArray(expense)) await outbox.putAll(expense);
            else await outbox.put(expense as Expense);
            void queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
        },
        [outbox, queryClient]
    );
}

export { useSaveExpense };
