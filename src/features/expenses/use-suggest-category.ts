import { useCallback, useMemo } from 'react';

import { useCategoryOptions } from '@/features/categories/use-category-options';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import { suggestCategory } from '@core/classifier';
import { indexHistory, suggestFromHistory } from '@core/history-suggestion';

import { useYourExpenses } from './use-your-expenses';

// The category to suggest for a description: the one the keywords give and, only when they find nothing, the one the
// person's earlier expenses point to, their part of the shared ones included. Left off, as for an expense that
// already has its category, it never looks at the history.
const useSuggestCategory = (enabled: boolean) => {
    const { expenses } = useYourExpenses();
    const { options } = useCategoryOptions();

    const index = useMemo(() => {
        if (!enabled) return null;
        const known = new Set(options.map((option) => option.id));
        return indexHistory(expenses, (categoryId) => known.has(categoryId));
    }, [enabled, expenses, options]);

    return useCallback(
        (text: string): string => {
            const keyword = suggestCategory(text);
            if (keyword !== FALLBACK_CATEGORY_ID || index === null) return keyword;
            return suggestFromHistory(text, index) ?? keyword;
        },
        [index]
    );
};

export { useSuggestCategory };
