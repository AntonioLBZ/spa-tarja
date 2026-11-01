import { describe, expect, it } from 'vitest';

import { DEFAULT_CATEGORY_IDS, FALLBACK_CATEGORY_ID, isDefaultCategoryId } from './categories';
import { CATEGORY_KEYWORDS } from './category-keywords';
import { suggestCategory } from './classifier';

describe('suggestCategory', () => {
    it('falls back to other when nothing matches', () => {
        expect(suggestCategory('')).toBe(FALLBACK_CATEGORY_ID);
        expect(suggestCategory('   ')).toBe(FALLBACK_CATEGORY_ID);
        expect(suggestCategory('zzz qqq')).toBe(FALLBACK_CATEGORY_ID);
    });

    it('recognizes Spanish and English keywords', () => {
        expect(suggestCategory('Mercadona')).toBe('groceries');
        expect(suggestCategory('weekly groceries')).toBe('groceries');
        expect(suggestCategory('farmacia')).toBe('health');
        expect(suggestCategory('pharmacy')).toBe('health');
        expect(suggestCategory('alquiler de octubre')).toBe('housing');
        expect(suggestCategory('rent')).toBe('housing');
        expect(suggestCategory('factura de la luz')).toBe('bills');
        expect(suggestCategory('gasolina')).toBe('transport');
        expect(suggestCategory('cena en restaurante')).toBe('food');
        expect(suggestCategory('cine')).toBe('leisure');
    });

    it('ignores case and accents', () => {
        expect(suggestCategory('CAFETERÍA')).toBe('food');
        expect(suggestCategory('Óptica')).toBe('health');
    });

    it('matches plurals', () => {
        expect(suggestCategory('taxis')).toBe('transport');
        expect(suggestCategory('tapas')).toBe('food');
    });

    it('matches whole words only', () => {
        expect(suggestCategory('barcelona')).toBe(FALLBACK_CATEGORY_ID);
        expect(suggestCategory('barato')).toBe(FALLBACK_CATEGORY_ID);
    });

    it('prefers a longer phrase over one of its words', () => {
        expect(suggestCategory('uber')).toBe('transport');
        expect(suggestCategory('uber eats')).toBe('food');
    });

    it('picks the category with the most matched words', () => {
        expect(suggestCategory('cine y cena en restaurante con pizza')).toBe('food');
    });

    it('ignores punctuation around words', () => {
        expect(suggestCategory('Netflix, (mensual)')).toBe('leisure');
    });
});

describe('default categories', () => {
    it('includes the fallback', () => {
        expect(DEFAULT_CATEGORY_IDS).toContain(FALLBACK_CATEGORY_ID);
    });

    it.each(DEFAULT_CATEGORY_IDS)('recognizes %s as a default one', (id) => {
        expect(isDefaultCategoryId(id)).toBe(true);
    });

    it.each([
        ['the id of a custom category', '2f9c0c2e-0000-4000-8000-000000000000'],
        ['an empty id', ''],
        ['a default id in other letters', 'Food'],
        ['a default id with spaces around it', ' food '],
        ['a number', 42],
        ['null', null],
    ])('recognizes nothing else, not %s', (_name, value) => {
        expect(isDefaultCategoryId(value)).toBe(false);
    });
});

describe('category keywords', () => {
    it('keeps every normalized keyword in a single category', () => {
        const owners = new Map<string, string>();
        const clashes: string[] = [];

        for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
            for (const keyword of keywords) {
                const key = keyword.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
                const owner = owners.get(key);
                if (owner !== undefined && owner !== category) clashes.push(`${key}: ${owner} and ${category}`);
                owners.set(key, category);
            }
        }

        expect(clashes).toEqual([]);
    });
});
