import * as v from 'valibot';

import { isDefaultCategoryId } from './categories';
import { categoryColorSchema, categoryIconSchema, type CategoryStyle } from './category-style';

const CATEGORY_NAME_MAX_LENGTH = 40;

const categoryIdSchema = v.pipe(v.string(), v.uuid());

// The style is optional so that a write which only renames keeps what the category looks like
const categoryInputSchema = v.object({
    name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(CATEGORY_NAME_MAX_LENGTH)),
    color: v.optional(categoryColorSchema),
    icon: v.optional(categoryIconSchema),
});

type CategoryInput = v.InferOutput<typeof categoryInputSchema>;

// A custom category; the default ones are fixed in code and have no row
type Category = { id: string; name: string } & CategoryStyle;

// What two names must differ in to count as different: case, accents and spacing don't
function categoryNameKey(name: string): string {
    return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

// Shape only: a default id or a UUID, whether or not that category still exists
function isCategoryId(value: unknown): boolean {
    return isDefaultCategoryId(value) || v.is(categoryIdSchema, value);
}

export { CATEGORY_NAME_MAX_LENGTH, categoryIdSchema, categoryInputSchema, categoryNameKey, isCategoryId };
export type { Category, CategoryInput };
