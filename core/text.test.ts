import { describe, expect, it } from 'vitest';

import { isVisibleText, normalizeText, searchWords } from './text';

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

describe('isVisibleText', () => {
    it.each(['Ana', ' a ', '\u{1F469}\u200D\u{1F4BB}', 'An\u00ADa', '.'])('sees something in %j', (text) => {
        expect(isVisibleText(text)).toBe(true);
    });

    it.each(['', '   ', '\u200B\u2060', '\uFEFF', '\u200E\u200F', '\u3164', '\uFE0F', '\u200B \u00AD'])(
        'sees nothing in %j',
        (text) => {
            expect(isVisibleText(text)).toBe(false);
        }
    );
});
