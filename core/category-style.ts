import * as v from 'valibot';

// Keys, never values: the colors are CSS tokens and the icons are drawn by the app
const CATEGORY_COLORS = ['vermillion', 'green', 'purple', 'blue', 'orange', 'sky', 'yellow', 'gray'] as const;

// The names of Material Symbols, in the order the picker shows them
const CATEGORY_ICONS = [
    'restaurant',
    'local_cafe',
    'local_bar',
    'fastfood',
    'bakery_dining',
    'shopping_cart',
    'shopping_bag',
    'storefront',
    'checkroom',
    'redeem',
    'sports_esports',
    'movie',
    'music_note',
    'sports_soccer',
    'fitness_center',
    'theater_comedy',
    'beach_access',
    'directions_bus',
    'directions_car',
    'local_gas_station',
    'train',
    'flight',
    'two_wheeler',
    'home',
    'bolt',
    'water_drop',
    'wifi',
    'receipt_long',
    'build',
    'bed',
    'medical_services',
    'local_pharmacy',
    'spa',
    'pets',
    'school',
    'child_care',
    'work',
    'savings',
    'payments',
    'credit_card',
    'account_balance',
    'subscriptions',
    'volunteer_activism',
    'more_horiz',
    'category',
] as const;

type CategoryColor = (typeof CATEGORY_COLORS)[number];
type CategoryIcon = (typeof CATEGORY_ICONS)[number];

interface CategoryStyle {
    color: CategoryColor;
    icon: CategoryIcon;
}

const DEFAULT_CATEGORY_COLOR = 'gray' satisfies CategoryColor;
const DEFAULT_CATEGORY_ICON = 'category' satisfies CategoryIcon;

const categoryColorSchema = v.picklist(CATEGORY_COLORS);
const categoryIconSchema = v.picklist(CATEGORY_ICONS);

// The color a new category starts with: the least used of the seven that stand out, the first one on ties. Gray is
// the plain look, so it is never picked for anyone.
function nextCategoryColor(used: readonly CategoryColor[]): CategoryColor {
    const colors = CATEGORY_COLORS.filter((color) => color !== DEFAULT_CATEGORY_COLOR);
    const uses = (color: CategoryColor) => used.filter((item) => item === color).length;
    return colors.reduce((best, color) => (uses(color) < uses(best) ? color : best));
}

function isCategoryColor(value: unknown): value is CategoryColor {
    return v.is(categoryColorSchema, value);
}

function isCategoryIcon(value: unknown): value is CategoryIcon {
    return v.is(categoryIconSchema, value);
}

export {
    CATEGORY_COLORS,
    CATEGORY_ICONS,
    DEFAULT_CATEGORY_COLOR,
    DEFAULT_CATEGORY_ICON,
    categoryColorSchema,
    categoryIconSchema,
    isCategoryColor,
    isCategoryIcon,
    nextCategoryColor,
};
export type { CategoryColor, CategoryIcon, CategoryStyle };
