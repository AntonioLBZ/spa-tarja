import { describe, expect, it } from 'vitest';

import { normalizeText, searchWords } from './text';

describe('normalizeText', () => {
    it('lowercases and strips the accents', () => {
        expect(normalizeText('Café con LECHE, Ñandú')).toBe('cafe con leche nandu');
    });

    it('collapses every run of punctuation and spaces into one space', () => {
        expect(normalizeText('  pan, leche; (queso)... ')).toBe('pan leche queso');
    });

    it('keeps digits and letters of any script', () => {
        expect(normalizeText('Menú 2 × 1 日本')).toBe('menu 2 1 日本');
    });

    it('is empty for nothing but punctuation', () => {
        expect(normalizeText(' ... ')).toBe('');
    });
});

describe('searchWords', () => {
    it('splits a query into its normalised words', () => {
        expect(searchWords('  Cafe   LECHE ')).toEqual(['cafe', 'leche']);
    });

    it('is empty for a blank query', () => {
        expect(searchWords('   ')).toEqual([]);
    });
});
