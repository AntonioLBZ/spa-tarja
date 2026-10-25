import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { CATEGORIES_KEY, deleteCategory, putCategory } from '@/lib/api';

import type { Category } from '@core/category';

// Each call waits for the server and then puts its answer in the cache, so the list never needs a refetch
function useCategoryActions() {
    const queryClient = useQueryClient();

    return useMemo(
        () => ({
            async save(category: Category) {
                const saved = await putCategory(category);
                queryClient.setQueryData<Category[]>(CATEGORIES_KEY, (list = []) =>
                    list.some((item) => item.id === saved.id)
                        ? list.map((item) => (item.id === saved.id ? saved : item))
                        : [...list, saved]
                );
            },
            async remove(id: string) {
                await deleteCategory(id);
                queryClient.setQueryData<Category[]>(CATEGORIES_KEY, (list = []) =>
                    list.filter((item) => item.id !== id)
                );
            },
        }),
        [queryClient]
    );
}

export { useCategoryActions };
