import { describe, expect, it } from 'vitest';

import { DEFAULT_CATEGORY_STYLES } from './categories';
import {
    CATEGORY_COLORS,
    CATEGORY_ICONS,
    DEFAULT_CATEGORY_COLOR,
    DEFAULT_CATEGORY_ICON,
    isCategoryColor,
    isCategoryIcon,
    nextCategoryColor,
} from './category-style';

describe('category colors', () => {
    it('are the eight, in order', () => {
        expect([...CATEGORY_COLORS]).toEqual([
            'vermillion',
            'green',
            'purple',
            'blue',
            'orange',
            'sky',
            'yellow',
            'gray',
        ]);
    });

    it('include the default one, gray', () => {
        expect(DEFAULT_CATEGORY_COLOR).toBe('gray');
        expect(isCategoryColor(DEFAULT_CATEGORY_COLOR)).toBe(true);
    });

    it.each(['red', '', 'GRAY', 7, null])('do not include %j', (value) => {
        expect(isCategoryColor(value)).toBe(false);
    });
});

describe('category icons', () => {
    it('have no repeats', () => {
        expect(new Set(CATEGORY_ICONS).size).toBe(CATEGORY_ICONS.length);
    });

    it('include the generic one, which is the default', () => {
        expect(DEFAULT_CATEGORY_ICON).toBe('category');
        expect(isCategoryIcon(DEFAULT_CATEGORY_ICON)).toBe(true);
    });

    it.each(['restaurant', 'more_horiz', 'volunteer_activism'])('include %s', (icon) => {
        expect(isCategoryIcon(icon)).toBe(true);
    });

    it.each(['rocket', '', 'Restaurant', 7, null])('do not include %j', (value) => {
        expect(isCategoryIcon(value)).toBe(false);
    });

    it('do not include the icons of the interface', () => {
        expect(isCategoryIcon('expand_more')).toBe(false);
    });
});

describe('nextCategoryColor', () => {
    it('starts with the first color', () => {
        expect(nextCategoryColor([])).toBe('vermillion');
    });

    it('takes the next one nobody uses yet', () => {
        expect(nextCategoryColor(['vermillion'])).toBe('green');
        expect(nextCategoryColor(['vermillion', 'purple'])).toBe('green');
        expect(nextCategoryColor(['vermillion', 'green', 'purple'])).toBe('blue');
    });

    it('is not drawn to gray, which is the plain look, and ignores who uses it', () => {
        expect(nextCategoryColor(['gray', 'gray'])).toBe('vermillion');
        expect(nextCategoryColor(['vermillion', 'green', 'purple', 'blue', 'orange', 'sky', 'yellow'])).not.toBe(
            'gray'
        );
    });

    it('goes round again, on the least used color, once all seven have a category', () => {
        const all = ['vermillion', 'green', 'purple', 'blue', 'orange', 'sky', 'yellow'] as const;

        expect(nextCategoryColor([...all])).toBe('vermillion');
        expect(nextCategoryColor([...all, 'vermillion', 'purple'])).toBe('green');
        expect(nextCategoryColor([...all, ...all, 'sky'])).toBe('vermillion');
    });
});

describe('default category styles', () => {
    it('give every default category a color and an icon from the lists', () => {
        for (const style of Object.values(DEFAULT_CATEGORY_STYLES)) {
            expect(isCategoryColor(style.color)).toBe(true);
            expect(isCategoryIcon(style.icon)).toBe(true);
        }
    });

    it('tell the default categories apart by icon, which is what the name always comes with', () => {
        const styles = Object.values(DEFAULT_CATEGORY_STYLES);

        expect(new Set(styles.map((style) => style.icon)).size).toBe(styles.length);
    });

    it('share a color only between a category and the one closest to it, never more than two to a color', () => {
        const uses = new Map<string, string[]>();
        for (const [id, style] of Object.entries(DEFAULT_CATEGORY_STYLES)) {
            uses.set(style.color, [...(uses.get(style.color) ?? []), id]);
        }

        expect(Math.max(...[...uses.values()].map((ids) => ids.length))).toBe(2);
        expect([...uses.values()].filter((ids) => ids.length > 1)).toEqual([
            ['leisure', 'treats'],
            ['housing', 'gifts'],
            ['health', 'personal'],
        ]);
    });

    it('leave gray to Other alone', () => {
        const gray = Object.entries(DEFAULT_CATEGORY_STYLES).filter(([, style]) => style.color === 'gray');

        expect(gray.map(([id]) => id)).toEqual(['other']);
    });

    it('give each default category its fixed color and icon', () => {
        expect(DEFAULT_CATEGORY_STYLES).toEqual({
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
        });
    });
});
