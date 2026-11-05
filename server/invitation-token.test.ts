import { describe, expect, it } from 'vitest';

import { isInvitationToken } from '@core/invitation';

import { readInvitationToken, signInvitation } from './invitation-token';

const SECRET = 'a-secret-that-is-long-enough-for-the-tests';
const ID = '0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f';

// The token with the character at that position of its signature changed
function altered(token: string, position: number) {
    const at = token.indexOf('.') + 1 + position;
    const replacement = token[at] === 'A' ? 'B' : 'A';
    return `${token.slice(0, at)}${replacement}${token.slice(at + 1)}`;
}

describe('invitation tokens', () => {
    it('name the invitation they were signed for', async () => {
        const token = await signInvitation(SECRET, ID);

        expect(isInvitationToken(token)).toBe(true);
        expect(token.startsWith(`${ID}.`)).toBe(true);
        expect(await readInvitationToken(SECRET, token)).toBe(ID);
    });

    it('are the same for the same invitation, so the open link can be listed again', async () => {
        expect(await signInvitation(SECRET, ID)).toBe(await signInvitation(SECRET, ID));
    });

    it('differ from one invitation to another', async () => {
        const other = '1c7a4d2f-9e3b-4d6c-8f80-2b3c4d5e6f70';

        expect(await signInvitation(SECRET, ID)).not.toBe(await signInvitation(SECRET, other));
    });

    it('are refused under another secret', async () => {
        const token = await signInvitation('another-secret-that-is-long-enough', ID);

        expect(await readInvitationToken(SECRET, token)).toBeNull();
    });

    it('are refused with a signature changed anywhere but its last character', async () => {
        const token = await signInvitation(SECRET, ID);

        for (const position of [0, 10, 21, 41]) {
            expect(await readInvitationToken(SECRET, altered(token, position))).toBeNull();
        }
    });

    it('are refused when the signature of one invitation is put on another', async () => {
        const token = await signInvitation(SECRET, ID);
        const other = '1c7a4d2f-9e3b-4d6c-8f80-2b3c4d5e6f70';

        expect(await readInvitationToken(SECRET, `${other}${token.slice(ID.length)}`)).toBeNull();
    });

    it('are refused in capitals', async () => {
        const token = await signInvitation(SECRET, ID);

        expect(await readInvitationToken(SECRET, token.toUpperCase())).toBeNull();
    });

    it.each([
        ['empty', ''],
        ['only the id', ID],
        ['the id with a made-up signature', `${ID}.${'A'.repeat(43)}`],
    ])('are refused when %s', async (_, token) => {
        expect(await readInvitationToken(SECRET, token)).toBeNull();
    });
});
