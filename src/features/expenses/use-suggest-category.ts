import { useCallback, useMemo } from 'react';

import { useCategoryOptions } from '@/features/categories/use-category-options';
import { FALLBACK_CATEGORY_ID } from '@core/categories';
import { suggestCategory } from '@core/classifier';
import { indexHistory, suggestFromHistory } from '@core/history-suggestion';

import { useExpenses } from './use-expenses';

// The category to suggest for a description: the one the keywords give and, only when they find nothing, the one the
// person's own earlier expenses point to. Left off, as for an expense that already has its
// category, it never looks at the history.
function useSuggestCategory(enabled: boolean) {
    const { expenses } = useExpenses();
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
}

export { useSuggestCategory };
