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
});
