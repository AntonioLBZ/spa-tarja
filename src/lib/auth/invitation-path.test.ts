import { describe, expect, it } from 'vitest';

import { invitationPath } from './invitation-path';

const TOKEN = `0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.${'Ab_-'.repeat(10)}xyz`;

describe('invitationPath', () => {
    it('is the path of the link of an invitation', () => {
        expect(invitationPath(`/join/${TOKEN}`)).toBe(`/join/${TOKEN}`);
    });

    it.each([
        ['home', '/'],
        ['another screen', '/settings'],
        ['the join page with nothing after it', '/join/'],
        ['a token of another shape', '/join/abc'],
        ['another origin after the prefix', '/join//evil.example/x'],
        ['an escaped slash', `/join/%2F%2Fevil.example.${'A'.repeat(43)}`],
        ['a backslash', `/join/\\\\evil.example`],
        ['a path after the token', `/join/${TOKEN}/x`],
        ['a token in capitals', `/join/${TOKEN.toUpperCase()}`],
        ['the token under another prefix', `/groups/join/${TOKEN}`],
        ['a full address', `https://evil.example/join/${TOKEN}`],
    ])('is nothing for %s', (_, pathname) => {
        expect(invitationPath(pathname)).toBeNull();
    });
});
