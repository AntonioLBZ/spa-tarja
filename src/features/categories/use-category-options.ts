import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { categoriesQuery } from '@/lib/api';
import { DEFAULT_CATEGORY_IDS, FALLBACK_CATEGORY_ID } from '@core/categories';

interface CategoryOption {
    id: string;
    label: string;
}

// The categories a person can file an expense under: the built-in ones, then their own
function useCategoryOptions() {
    const t = useTranslations('categories');
    const { data: custom } = useQuery(categoriesQuery());

    return useMemo(() => {
        const options: CategoryOption[] = [
            ...DEFAULT_CATEGORY_IDS.map((id) => ({ id, label: t(id) })),
            ...(custom ?? []).map(({ id, name }) => ({ id, label: name })),
        ];
        const labels = new Map(options.map((option) => [option.id, option.label]));

        // An id with no category behind it (deleted, or not heard of yet) reads as the fallback
        function labelOf(id: string): string {
            return labels.get(id) ?? t(FALLBACK_CATEGORY_ID);
        }

        return { options, labelOf };
    }, [custom, t]);
}

export { useCategoryOptions };
export type { CategoryOption };
