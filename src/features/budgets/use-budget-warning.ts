import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { useToast } from '@/components/toast/toast';
import { useCategoryOptions } from '@/features/categories/use-category-options';
import { useExpenses } from '@/features/expenses/use-expenses';
import { incomeQuery } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import { TOTAL_SCOPE } from '@core/budget';
import { budgetWarning } from '@core/budget-warning';
import { fromDateString, toDateString } from '@core/date';

import { useBudgets } from './use-budgets';

import type { Expense } from '@core/expense';

// Tells the person, in a toast, what the expenses they have just added did to a month (ARCHITECTURE.md §5). It reads the
// expenses of the render it was made in, which are the ones from before the save, so a call after the save compares
// the month as it was with the month as it is.
function useBudgetWarning(): (added: readonly Expense[]) => void {
    const t = useTranslations('budgets.warning');
    const { locale } = useLocale();
    const toast = useToast();
    const { expenses } = useExpenses();
    const { budgets, scopes, categoryOf } = useBudgets();
    const { labelOf } = useCategoryOptions();
    const income = useQuery(incomeQuery());

    const monthOnly = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long' }), [locale]);
    const monthAndYear = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);

    return (added) => {
        const warning = budgetWarning({
            before: expenses,
            added,
            budgets,
            income: income.data ?? [],
            scopes,
            categoryOf,
        });
        if (warning === null) return;

        // The year only when the month is in another one
        const sameYear = warning.month.slice(0, 4) === toDateString(new Date()).slice(0, 4);
        const month = (sameYear ? monthOnly : monthAndYear).format(fromDateString(`${warning.month}-01`));
        const percent = warning.percent ?? 0;

        if (warning.kind === 'negative') toast.show({ message: t('negative', { month }) });
        else if (warning.scope === TOTAL_SCOPE) toast.show({ message: t(`${warning.kind}Total`, { month, percent }) });
        else toast.show({ message: t(warning.kind, { month, percent, name: labelOf(warning.scope) }) });
    };
}

export { useBudgetWarning };
