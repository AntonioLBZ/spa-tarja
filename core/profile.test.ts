import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { NICKNAME_MAX_LENGTH, profileInputSchema } from './profile';

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

    it.each([
        '\u200E',
        '\u200F',
        '\u202A',
        '\u202B',
        '\u202C',
        '\u202D',
        '\u202E',
        '\u2066',
        '\u2067',
        '\u2068',
        '\u2069',
    ])('rejects a nickname with a direction control among visible characters: %j', (control) => {
        expect(v.safeParse(profileInputSchema, { nickname: `${control}uoy sewo Ana` }).success).toBe(false);
        expect(v.safeParse(profileInputSchema, { nickname: `Ana${control}` }).success).toBe(false);
    });

    it('keeps a nickname whose invisible characters sit among visible ones', () => {
        expect(v.parse(profileInputSchema, { nickname: '\u{1F469}\u200D\u{1F4BB} Ana' })).toEqual({
            nickname: '\u{1F469}\u200D\u{1F4BB} Ana',
        });
        expect(v.parse(profileInputSchema, { nickname: 'An\u00ADa' })).toEqual({ nickname: 'An\u00ADa' });
    });
});
