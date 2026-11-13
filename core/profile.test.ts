import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { NICKNAME_MAX_LENGTH, firstName, profileInputSchema } from './profile';

describe('profileInputSchema', () => {
    it('keeps a nickname, trimmed', () => {
        expect(v.parse(profileInputSchema, { nickname: '  Ana ' })).toEqual({ nickname: 'Ana' });
    });

    it('takes null, which removes the nickname', () => {
        expect(v.parse(profileInputSchema, { nickname: null })).toEqual({ nickname: null });
    });

    it('accepts a nickname of exactly the maximum length, counted after trimming', () => {
        const nickname = 'x'.repeat(NICKNAME_MAX_LENGTH);

        expect(v.parse(profileInputSchema, { nickname: ` ${nickname} ` })).toEqual({ nickname });
    });

    it.each([
        ['empty', { nickname: '' }],
        ['only spaces', { nickname: '   ' }],
        ['too long', { nickname: 'x'.repeat(NICKNAME_MAX_LENGTH + 1) }],
        ['not a string', { nickname: 7 }],
        ['missing', {}],
    ])('rejects a nickname that is %s', (_, input) => {
        expect(v.safeParse(profileInputSchema, input).success).toBe(false);
    });

    it('counts the length in UTF-16 code units, so an emoji takes two', () => {
        const half = NICKNAME_MAX_LENGTH / 2;

        expect(v.safeParse(profileInputSchema, { nickname: '🙂'.repeat(half) }).success).toBe(true);
        expect(v.safeParse(profileInputSchema, { nickname: '🙂'.repeat(half + 1) }).success).toBe(false);
    });

    it.each([
        ['zero-width spaces', '\u200B\u200B'],
        ['a word joiner', '\u2060'],
        ['a byte order mark', '\uFEFF'],
        ['zero-width joiners and non-joiners', '\u200C\u200D'],
        ['direction marks', '\u200E\u200F'],
        ['a soft hyphen', '\u00AD'],
        ['a Hangul filler', '\u3164'],
        ['a variation selector', '\uFE0F'],
        ['invisible characters around a space', '\u200B \u2060'],
    ])('rejects a nickname with nothing visible in it: %s', (_, nickname) => {
        expect(v.safeParse(profileInputSchema, { nickname }).success).toBe(false);
    });

    it.each(['\u202A', '\u202B', '\u202C', '\u202D', '\u202E', '\u2066', '\u2067', '\u2068', '\u2069'])(
        'rejects a nickname with a direction control among visible characters: %j',
        (control) => {
            expect(v.safeParse(profileInputSchema, { nickname: `${control}uoy sewo Ana` }).success).toBe(false);
            expect(v.safeParse(profileInputSchema, { nickname: `Ana${control}` }).success).toBe(false);
        }
    );

    it.each(['\u200E', '\u200F'])('keeps a nickname with the plain mark %j among visible characters', (mark) => {
        const nickname = `${mark}\u05D0\u05E0\u05D4 Ana${mark}`;

        expect(v.parse(profileInputSchema, { nickname })).toEqual({ nickname });
    });

    it('keeps a nickname whose invisible characters sit among visible ones', () => {
        expect(v.parse(profileInputSchema, { nickname: '\u{1F469}\u200D\u{1F4BB} Ana' })).toEqual({
            nickname: '\u{1F469}\u200D\u{1F4BB} Ana',
        });
        expect(v.parse(profileInputSchema, { nickname: 'An\u00ADa' })).toEqual({ nickname: 'An\u00ADa' });
    });
});

describe('firstName', () => {
    it('is the first word of the name of the account', () => {
        expect(firstName('Ana García López')).toBe('Ana');
        expect(firstName('  María José  Pérez ')).toBe('María');
        expect(firstName('Ana')).toBe('Ana');
    });

    it('splits on any space, a no-break space or a tab included', () => {
        expect(firstName('Ana\u00A0García')).toBe('Ana');
        expect(firstName('Ana\tGarcía')).toBe('Ana');
    });

    it('skips a word with nothing visible and takes the direction controls out', () => {
        expect(firstName('\u200B Ana García')).toBe('Ana');
        expect(firstName('\u202EAna\u202C García')).toBe('Ana');
    });

    it('is empty when the name has nothing visible', () => {
        expect(firstName('')).toBe('');
        expect(firstName(' \u200B ')).toBe('');
    });
});
