import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { EXPENSES_KEY } from '@/lib/api';
import { useOutbox } from '@/lib/offline';

import type { Expense } from '@core/expense';

// Saving never waits for the network: the expense is safe on the device once this resolves.
// It rejects only when the device can't store it.
function useSaveExpense() {
    const outbox = useOutbox();
    const queryClient = useQueryClient();

    return useCallback(
        async (expense: Expense) => {
            await outbox.put(expense);
            void queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
        },
        [outbox, queryClient]
    );
}

export { useSaveExpense };
