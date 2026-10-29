import type { CategoryStyle } from './category-style';

// Ids are stable: expenses store them, and the locale files translate their names
const DEFAULT_CATEGORY_IDS = [
    'food',
    'groceries',
    'leisure',
    'bills',
    'housing',
    'transport',
    'health',
    'other',
] as const;

type DefaultCategoryId = (typeof DEFAULT_CATEGORY_IDS)[number];

const FALLBACK_CATEGORY_ID = 'other' satisfies DefaultCategoryId;

// What each default category looks like; fixed, unlike the custom ones (ADR-0006)
const DEFAULT_CATEGORY_STYLES: Record<DefaultCategoryId, CategoryStyle> = {
    food: { color: 'vermillion', icon: 'restaurant' },
    groceries: { color: 'green', icon: 'shopping_cart' },
    leisure: { color: 'purple', icon: 'sports_esports' },
    bills: { color: 'blue', icon: 'receipt_long' },
    housing: { color: 'orange', icon: 'home' },
    transport: { color: 'sky', icon: 'directions_bus' },
    health: { color: 'yellow', icon: 'medical_services' },
    other: { color: 'gray', icon: 'more_horiz' },
};

function isDefaultCategoryId(value: unknown): value is DefaultCategoryId {
    return DEFAULT_CATEGORY_IDS.some((id) => id === value);
}

export { DEFAULT_CATEGORY_IDS, DEFAULT_CATEGORY_STYLES, FALLBACK_CATEGORY_ID, isDefaultCategoryId };
export type { DefaultCategoryId };
