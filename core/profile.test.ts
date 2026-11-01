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
        ['zero-width spaces', '​​'],
        ['a word joiner', '⁠'],
        ['a byte order mark', '﻿'],
        ['zero-width joiners and non-joiners', '‌‍'],
        ['direction marks', '‎‏'],
        ['a soft hyphen', '­'],
        ['a Hangul filler', 'ㅤ'],
        ['a variation selector', '️'],
        ['invisible characters around a space', '​ ⁠'],
    ])('rejects a nickname with nothing visible in it: %s', (_, nickname) => {
        expect(v.safeParse(profileInputSchema, { nickname }).success).toBe(false);
    });

    it('keeps a nickname whose invisible characters sit among visible ones', () => {
        expect(v.parse(profileInputSchema, { nickname: '👩‍💻 Ana' })).toEqual({ nickname: '👩‍💻 Ana' });
        expect(v.parse(profileInputSchema, { nickname: 'An­a' })).toEqual({ nickname: 'An­a' });
    });
});
