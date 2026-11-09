import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { withFramingHeaders } from '@server/headers';
import { send } from '@server/test/groups';
import { ORIGIN, signIn, type TestSession } from '@server/test/session';

const FRAMING = {
    'content-security-policy': "frame-ancestors 'none'",
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin',
};

function framing(response: Response) {
    return {
        'content-security-policy': response.headers.get('content-security-policy'),
        'x-frame-options': response.headers.get('x-frame-options'),
        'referrer-policy': response.headers.get('referrer-policy'),
    };
}

let ana: TestSession;

beforeEach(async () => {
    ana = await signIn();
});

describe('the headers against framing', () => {
    it('are on the health check', async () => {
        const response = await app.request('/api/health', {}, env);

        expect(response.status).toBe(200);
        expect(framing(response)).toEqual(FRAMING);
    });

    it('are on an answer to a signed-in user', async () => {
        const response = await send(ana, 'GET', '/expenses');

        expect(response.status).toBe(200);
        expect(framing(response)).toEqual(FRAMING);
    });

    it('are on a write', async () => {
        const response = await send(ana, 'PUT', '/profile', { nickname: 'Anita' });

        expect(response.status).toBe(200);
        expect(framing(response)).toEqual(FRAMING);
    });

    it('are on a 401', async () => {
        const response = await app.request('/api/expenses', {}, env);

        expect(response.status).toBe(401);
        expect(framing(response)).toEqual(FRAMING);
    });

    it('are on a 400', async () => {
        const response = await send(ana, 'PUT', '/groups/not-an-id', {});

        expect(response.status).toBe(400);
        expect(framing(response)).toEqual(FRAMING);
    });

    it('are on a path the Worker does not know', async () => {
        const response = await app.request('/api/nothing-here', {}, env);

        expect(response.status).toBe(404);
        expect(framing(response)).toEqual(FRAMING);
    });

    it('are on a session answer of Better Auth', async () => {
        const response = await app.request('/api/auth/get-session', { headers: ana.headers }, env);

        expect(response.status).toBe(200);
        expect(framing(response)).toEqual(FRAMING);
    });

    it('are on the redirect Better Auth answers when a sign-in comes back broken', async () => {
        const response = await app.request(
            '/api/auth/callback/google?code=made-up&state=made-up',
            { headers: { origin: ORIGIN } },
            env
        );

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).not.toBeNull();
        expect(framing(response)).toEqual(FRAMING);
    });

    it('are on an answer whose headers cannot be changed', async () => {
        const unchangeable = new Hono()
            .use(withFramingHeaders)
            .get('/', () => Response.redirect(`${ORIGIN}/elsewhere`, 302));

        const response = await unchangeable.request('/');

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(`${ORIGIN}/elsewhere`);
        expect(framing(response)).toEqual(FRAMING);
    });

    it('keep every cookie an answer sets, one by one', async () => {
        const cookies = new Hono()
            .use(withFramingHeaders)
            .get('/', (c) => {
                c.header('Set-Cookie', 'a=1; Path=/', { append: true });
                c.header('Set-Cookie', 'b=2; Path=/', { append: true });
                return c.body(null, 204);
            })
            .get('/raw', () => {
                const headers = new Headers();
                headers.append('Set-Cookie', 'a=1; Path=/');
                headers.append('Set-Cookie', 'b=2; Path=/');
                return new Response(null, { status: 204, headers });
            });

        for (const path of ['/', '/raw']) {
            const response = await cookies.request(path);

            expect(response.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
            expect(framing(response)).toEqual(FRAMING);
        }
    });

    it('keep the headers the answer had', async () => {
        const response = await app.request('/api/health', {}, env);

        expect(response.headers.get('content-type')).toContain('application/json');
        expect(await response.json()).toEqual({ ok: true });
    });
});
