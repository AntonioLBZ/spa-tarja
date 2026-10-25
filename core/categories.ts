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

function isDefaultCategoryId(value: unknown): value is DefaultCategoryId {
    return DEFAULT_CATEGORY_IDS.some((id) => id === value);
}

export { DEFAULT_CATEGORY_IDS, FALLBACK_CATEGORY_ID, isDefaultCategoryId };
export type { DefaultCategoryId };
