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
    'personal',
    'treats',
    'gifts',
    'other',
] as const;

type DefaultCategoryId = (typeof DEFAULT_CATEGORY_IDS)[number];

const FALLBACK_CATEGORY_ID = 'other' satisfies DefaultCategoryId;

// What each default category looks like; fixed, unlike the custom ones (ADR-0006). The palette has eight colors, so
// related categories share one in pairs: the icon and the name tell them apart.
const DEFAULT_CATEGORY_STYLES: Record<DefaultCategoryId, CategoryStyle> = {
    food: { color: 'vermillion', icon: 'restaurant' },
    groceries: { color: 'green', icon: 'shopping_cart' },
    leisure: { color: 'purple', icon: 'theater_comedy' },
    bills: { color: 'blue', icon: 'receipt_long' },
    housing: { color: 'orange', icon: 'home' },
    transport: { color: 'sky', icon: 'directions_bus' },
    health: { color: 'yellow', icon: 'medical_services' },
    personal: { color: 'yellow', icon: 'checkroom' },
    treats: { color: 'purple', icon: 'sports_esports' },
    gifts: { color: 'orange', icon: 'redeem' },
    other: { color: 'gray', icon: 'more_horiz' },
};

const isDefaultCategoryId = (value: unknown): value is DefaultCategoryId => {
    return DEFAULT_CATEGORY_IDS.some((id) => id === value);
};

export {
    DEFAULT_CATEGORY_IDS,
    DEFAULT_CATEGORY_STYLES,
    FALLBACK_CATEGORY_ID,
    isDefaultCategoryId,
    type DefaultCategoryId,
};
