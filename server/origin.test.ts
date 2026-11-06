import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { makeFriend } from '@server/test/groups';
import { ORIGIN, signIn, type TestSession } from '@server/test/session';

const SIBLING = 'https://evil.albz.app';

let ana: TestSession;

beforeEach(async () => {
    ana = await signIn();
});

function from(origin: string | null, body?: unknown, as: TestSession = ana) {
    const headers = new Headers(as.headers);
    if (origin !== null) headers.set('origin', origin);
    if (body !== undefined) headers.set('content-type', 'application/json');
    return (method: string, path: string) =>
        app.request(
            `/api${path}`,
            { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
            env
        );
}

async function openLinks() {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM friend_invitations').first<{ n: number }>();
    return row?.n;
}

describe('a write from another origin', () => {
    it.each([SIBLING, 'null', 'http://localhost:5173', 'https://localhost', ''])(
        'is refused on a body-less POST and a JSON PUT when it says it comes from %j',
        async (origin) => {
            const friend = await makeFriend(ana);

            const direct = await from(origin)('POST', '/invitations');
            const forFriend = await from(origin)('POST', `/groups/${friend.id}/invitations`);
            const profile = await from(origin, { nickname: 'Anita' })('PUT', '/profile');
            const remove = await from(origin)('DELETE', `/groups/${friend.id}`);

            for (const response of [direct, forFriend, profile, remove]) {
                expect(response.status).toBe(403);
                expect(await response.json()).toEqual({ error: 'bad-origin' });
            }
            expect(await openLinks()).toBe(0);
            expect(await (await from(ORIGIN)('GET', '/profile')).json()).toMatchObject({ nickname: null });
        }
    );

    it('keeps the headers against framing on the refusal', async () => {
        const response = await from(SIBLING)('POST', '/invitations');

        expect(response.status).toBe(403);
        expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
        expect(response.headers.get('x-frame-options')).toBe('DENY');
        expect(response.headers.get('referrer-policy')).toBe('strict-origin');
    });

    it('is refused before anybody asks who is writing', async () => {
        const anonymous = { userId: '', headers: new Headers() };

        const response = await from(SIBLING, undefined, anonymous)('POST', '/invitations');

        expect(response.status).toBe(403);
    });

    it('goes through from the origin of the app', async () => {
        const link = await from(ORIGIN)('POST', '/invitations');
        const profile = await from(ORIGIN, { nickname: 'Anita' })('PUT', '/profile');

        expect(link.status).toBe(200);
        expect(profile.status).toBe(200);
        expect(await openLinks()).toBe(1);
    });

    it('goes through from a request that says nothing of its origin', async () => {
        const link = await from(null)('POST', '/invitations');
        const profile = await from(null, { nickname: 'Anita' })('PUT', '/profile');

        expect(link.status).toBe(200);
        expect(profile.status).toBe(200);
    });

    it('leaves a read from another origin alone', async () => {
        const response = await from(SIBLING)('GET', '/profile');

        expect(response.status).toBe(200);
    });

    it('is left to Better Auth under /api/auth', async () => {
        const response = await from(SIBLING)('POST', '/auth/sign-out');

        expect(await response.text()).not.toContain('bad-origin');
        const own = await from(ORIGIN)('POST', '/auth/sign-out');
        expect(own.status).toBe(200);
    });
});
