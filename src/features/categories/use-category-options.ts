import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import { categoriesQuery } from '@/lib/api';
import { DEFAULT_CATEGORY_IDS, DEFAULT_CATEGORY_STYLES, FALLBACK_CATEGORY_ID } from '@core/categories';

import type { CategoryStyle } from '@core/category-style';

interface CategoryOption {
    id: string;
    label: string;
    style: CategoryStyle;
}

// The categories a person can file an expense under: the built-in ones, then their own
function useCategoryOptions() {
    const t = useTranslations('categories');
    const { data: custom } = useQuery(categoriesQuery());

    return useMemo(() => {
        const options: CategoryOption[] = [
            ...DEFAULT_CATEGORY_IDS.map((id) => ({ id, label: t(id), style: DEFAULT_CATEGORY_STYLES[id] })),
            ...(custom ?? []).map(({ id, name, color, icon }) => ({ id, label: name, style: { color, icon } })),
        ];
        const byId = new Map(options.map((option) => [option.id, option]));

        // An id with no category behind it (deleted, or not heard of yet) reads as the fallback
        function labelOf(id: string): string {
            return byId.get(id)?.label ?? t(FALLBACK_CATEGORY_ID);
        }

        function styleOf(id: string): CategoryStyle {
            return byId.get(id)?.style ?? DEFAULT_CATEGORY_STYLES[FALLBACK_CATEGORY_ID];
        }

        return { options, labelOf, styleOf };
    }, [custom, t]);
}

export { useCategoryOptions };
export type { CategoryOption };
