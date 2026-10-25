import { useMemo } from 'react';

import { groupByDay } from '@core/expense-groups';

import { useExpenses } from './use-expenses';

// The expenses by the day they were made, newest first
function useExpenseGroups() {
    const { expenses, ...rest } = useExpenses();
    const groups = useMemo(() => groupByDay(expenses), [expenses]);

    return { groups, ...rest };
}

export { useExpenseGroups };
