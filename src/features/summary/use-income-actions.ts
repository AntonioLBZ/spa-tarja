import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { INCOME_KEY, deleteIncome, putIncome } from '@/lib/api';

import type { Income, IncomeInput } from '@core/income';

// Each call waits for the server and then puts its answer in the cache, so the months never need a refetch
const useIncomeActions = () => {
    const queryClient = useQueryClient();

    return useMemo(
        () => ({
            async save(month: string, input: IncomeInput) {
                const saved = await putIncome(month, input);
                queryClient.setQueryData<Income[]>(INCOME_KEY, (list = []) =>
                    list.some((item) => item.month === month)
                        ? list.map((item) => (item.month === month ? saved : item))
                        : [...list, saved]
                );
            },
            async remove(month: string) {
                await deleteIncome(month);
                queryClient.setQueryData<Income[]>(INCOME_KEY, (list = []) =>
                    list.filter((item) => item.month !== month)
                );
            },
        }),
        [queryClient]
    );
};

export { useIncomeActions };
