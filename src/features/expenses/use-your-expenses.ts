import { useMemo } from 'react';

import { useSharedExpenseRows } from '@/features/groups/use-shared-expense-rows';

import { useExpenses } from './use-expenses';

import type { Expense } from '@core/expense';

// What adds up as the person's expenses: theirs alone, with their part of the expenses of the groups that show in them
// on top, derived on the device and never stored (ADR-0012)
const useYourExpenses = () => {
    const own = useExpenses();
    const shared = useSharedExpenseRows();

    const expenses = useMemo((): Expense[] => [...own.expenses, ...shared.rows], [own.expenses, shared.rows]);
    const pendingIds = useMemo(
        () => new Set([...own.pendingIds, ...shared.pendingIds]),
        [own.pendingIds, shared.pendingIds]
    );

    return { ...own, expenses, pendingIds, sourceOf: shared.sourceOf };
};

export { useYourExpenses };
