import { describe, expect, it } from 'vitest';

import { hasDirectionControls, isVisibleText, normalizeText, searchWords, stripDirectionControls } from './text';

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

const MARKS = ['\u200E', '\u200F'];

const OVERRIDES_AND_ISOLATES = [
    '\u202A',
    '\u202B',
    '\u202C',
    '\u202D',
    '\u202E',
    '\u2066',
    '\u2067',
    '\u2068',
    '\u2069',
];

describe('direction controls', () => {
    it.each(OVERRIDES_AND_ISOLATES)('are found, and taken out, in a name with %j in it', (control) => {
        const name = `An${control}a`;

        expect(hasDirectionControls(name)).toBe(true);
        expect(stripDirectionControls(name)).toBe('Ana');
    });

    it.each(MARKS)(
        'are not found in a name with the plain mark %j, which is still taken out of an account name',
        (mark) => {
            const name = `An${mark}a`;

            expect(hasDirectionControls(name)).toBe(false);
            expect(stripDirectionControls(name)).toBe('Ana');
        }
    );

    it('are not found in a name that sets none, joiners and emoji included', () => {
        const name = 'Ana \u{1F469}\u200D\u{1F4BB} Mar\u00EDa';

        expect(hasDirectionControls(name)).toBe(false);
        expect(stripDirectionControls(name)).toBe(name);
    });

    it('are all taken out of a name that has several', () => {
        expect(stripDirectionControls('\u202Euoy\u2066 sewo\u202C Ana')).toBe('uoy sewo Ana');
    });
});
