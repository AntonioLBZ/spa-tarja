import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import { invitationTokenSchema, isInvitationToken } from './invitation';

const ID = '0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f';
const SIGNATURE = 'Ab_-0123456789abcdefghijklmnopqrstuvwxyzABc';

describe('isInvitationToken', () => {
    it('takes an id and a signature of the right length', () => {
        expect(SIGNATURE).toHaveLength(43);
        expect(isInvitationToken(`${ID}.${SIGNATURE}`)).toBe(true);
    });

    it.each([
        ['empty', ''],
        ['only an id', ID],
        ['an id in capitals', `${ID.toUpperCase()}.${SIGNATURE}`],
        ['a short signature', `${ID}.${SIGNATURE.slice(1)}`],
        ['a long signature', `${ID}.${SIGNATURE}A`],
        ['a slash in it', `${ID}.${SIGNATURE.slice(1)}/`],
        ['a padded signature', `${ID}.${SIGNATURE.slice(1)}=`],
        ['two dots', `${ID}..${SIGNATURE.slice(1)}`],
        ['a path after it', `${ID}.${SIGNATURE}/x`],
        ['a line after it', `${ID}.${SIGNATURE}\n`],
        ['a last character that spells the signature another way', `${ID}.${SIGNATURE.slice(0, -1)}d`],
    ])('refuses %s', (_, token) => {
        expect(isInvitationToken(token)).toBe(false);
    });
});

describe('invitationTokenSchema', () => {
    it.each([
        ['a string of the wrong shape', 'nonsense'],
        ['a string far too long', 'x'.repeat(5000)],
        ['a number', 7],
        ['null', null],
    ])('takes %s as the token, whose shape is checked when it is read', (_, token) => {
        expect(v.parse(invitationTokenSchema, { token })).toEqual({ token });
    });

    it.each([
        ['missing', {}],
        ['not an object', 'nonsense'],
    ])('refuses a body that is %s', (_, body) => {
        expect(v.safeParse(invitationTokenSchema, body).success).toBe(false);
    });
});
