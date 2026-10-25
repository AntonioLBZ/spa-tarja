import { ApiError, toApiError } from './api-error';
import { api } from './client';

import type { Category } from '@core/category';

const CATEGORIES_KEY = ['categories'] as const;

async function fetchCategories(): Promise<Category[]> {
    const response = await api.api.categories.$get();
    if (!response.ok) throw new ApiError(response.status);
    return (await response.json()).categories;
}

// Creates or renames by id, so sending it twice is harmless. A refusal carries its reason in `code`.
async function putCategory(category: Category): Promise<Category> {
    const { id, name, color, icon } = category;
    const response = await api.api.categories[':id'].$put({ param: { id }, json: { name, color, icon } });
    if (!response.ok) throw await toApiError(response);
    return response.json();
}

async function deleteCategory(id: string): Promise<void> {
    const response = await api.api.categories[':id'].$delete({ param: { id } });
    if (!response.ok) throw new ApiError(response.status);
}

export { CATEGORIES_KEY, deleteCategory, fetchCategories, putCategory };
