import * as v from 'valibot';

import { isDefaultCategoryId } from './categories';

const CATEGORY_NAME_MAX_LENGTH = 40;

const categoryIdSchema = v.pipe(v.string(), v.uuid());

const categoryInputSchema = v.object({
    name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(CATEGORY_NAME_MAX_LENGTH)),
});

type CategoryInput = v.InferOutput<typeof categoryInputSchema>;

// A custom category; the default ones live in `categories.ts` and have no row
type Category = CategoryInput & { id: string };

// What two names must differ in to count as different: case, accents and spacing don't
function categoryNameKey(name: string): string {
    return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

// Shape only: a default id or a UUID, whether or not that category still exists (ARCHITECTURE.md §7)
function isCategoryId(value: unknown): boolean {
    return isDefaultCategoryId(value) || v.is(categoryIdSchema, value);
}

export { CATEGORY_NAME_MAX_LENGTH, categoryIdSchema, categoryInputSchema, categoryNameKey, isCategoryId };
export type { Category, CategoryInput };
