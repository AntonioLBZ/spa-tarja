import { DEFAULT_CATEGORY_IDS, DEFAULT_CATEGORY_STYLES } from '@core/categories';
import { useMemo } from 'react';
import { useTranslations } from 'use-intl';

import type { Category } from '@core/category';
import type { CategoryStyle } from '@core/category-style';

const CUSTOM_CATEGORIES: readonly Category[] = [
    { id: 'custom-pets', name: 'Pets', color: 'orange', icon: 'pets' },
    { id: 'custom-gym', name: 'Gym', color: 'blue', icon: 'fitness_center' },
];

interface StoryCategory {
    id: string;
    label: string;
    style: CategoryStyle;
}

// The categories of the app, named in the chosen language, and two of the person's own
function useStoryCategories() {
    const t = useTranslations('categories');

    return useMemo(() => {
        const options: StoryCategory[] = [
            ...DEFAULT_CATEGORY_IDS.map((id) => ({ id, label: t(id), style: DEFAULT_CATEGORY_STYLES[id] })),
            ...CUSTOM_CATEGORIES.map(({ id, name, color, icon }) => ({ id, label: name, style: { color, icon } })),
        ];
        const byId = new Map(options.map((option) => [option.id, option]));

        return {
            options,
            labelOf: (id: string) => byId.get(id)?.label ?? id,
            styleOf: (id: string) => byId.get(id)?.style ?? DEFAULT_CATEGORY_STYLES.other,
        };
    }, [t]);
}

export { CUSTOM_CATEGORIES, useStoryCategories };
export type { StoryCategory };
