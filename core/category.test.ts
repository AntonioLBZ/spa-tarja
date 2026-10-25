import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import {
    CATEGORY_NAME_MAX_LENGTH,
    categoryIdSchema,
    categoryInputSchema,
    categoryNameKey,
    isCategoryId,
} from './category';

describe('categoryInputSchema', () => {
    it('keeps a name, trimmed', () => {
        expect(v.parse(categoryInputSchema, { name: '  Gym ' })).toEqual({ name: 'Gym' });
    });

    it.each([
        ['empty', ''],
        ['only spaces', '   '],
        ['too long', 'x'.repeat(CATEGORY_NAME_MAX_LENGTH + 1)],
        ['not a string', 7],
    ])('rejects a name that is %s', (_, name) => {
        expect(v.safeParse(categoryInputSchema, { name }).success).toBe(false);
    });

    it('accepts a name of exactly the maximum length', () => {
        const name = 'x'.repeat(CATEGORY_NAME_MAX_LENGTH);

        expect(v.safeParse(categoryInputSchema, { name }).success).toBe(true);
    });
});

describe('categoryNameKey', () => {
    it('ignores case, accents and extra spaces', () => {
        expect(categoryNameKey('  Café   Con  Leche ')).toBe('cafe con leche');
    });

    it('tells different names apart', () => {
        expect(categoryNameKey('Gym')).not.toBe(categoryNameKey('Gyms'));
    });
});

describe('isCategoryId', () => {
    it('accepts a default id and a UUID', () => {
        expect(isCategoryId('food')).toBe(true);
        expect(isCategoryId(crypto.randomUUID())).toBe(true);
    });

    it.each(['nope', '', 'FOOD', 'not-a-uuid-at-all', 42, null])('rejects %j', (value) => {
        expect(isCategoryId(value)).toBe(false);
    });
});

describe('categoryIdSchema', () => {
    it('is a UUID', () => {
        expect(v.safeParse(categoryIdSchema, crypto.randomUUID()).success).toBe(true);
        expect(v.safeParse(categoryIdSchema, 'food').success).toBe(false);
    });
});
