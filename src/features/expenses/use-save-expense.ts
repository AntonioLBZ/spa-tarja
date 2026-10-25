import { useMutation, useQueryClient } from '@tanstack/react-query';

import { EXPENSES_KEY, putExpense, upsertExpense, type ExpensesState } from '@/lib/api';

import type { Expense } from '@core/expense';

// The expense shows up at once; if the server refuses it, the list goes back to how it was
function useSaveExpense() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: putExpense,
        onMutate: async (expense: Expense) => {
            await queryClient.cancelQueries({ queryKey: EXPENSES_KEY });
            const previous = queryClient.getQueryData<ExpensesState>(EXPENSES_KEY);
            if (previous) queryClient.setQueryData(EXPENSES_KEY, upsertExpense(previous, expense));
            return { previous };
        },
        onError: (_error, _expense, context) => {
            if (context?.previous) queryClient.setQueryData(EXPENSES_KEY, context.previous);
            else void queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
        },
        onSuccess: (saved) => {
            const current = queryClient.getQueryData<ExpensesState>(EXPENSES_KEY);
            if (current) queryClient.setQueryData(EXPENSES_KEY, upsertExpense(current, saved));
            else void queryClient.invalidateQueries({ queryKey: EXPENSES_KEY });
        },
    });
}

export { useSaveExpense };
