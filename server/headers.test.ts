import { env } from 'cloudflare:workers';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { withSecurityHeaders } from '@server/headers';
import { send } from '@server/test/groups';
import { ORIGIN, signIn, type TestSession } from '@server/test/session';

const SECURITY = {
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin',
    'x-content-type-options': 'nosniff',
    'cross-origin-opener-policy': 'same-origin-allow-popups',
};

function security(response: Response) {
    return Object.fromEntries(Object.keys(SECURITY).map((name) => [name, response.headers.get(name)]));
}

let ana: TestSession;

beforeEach(async () => {
    ana = await signIn();
});

describe('the security headers', () => {
    it('are on the health check', async () => {
        const response = await app.request('/api/health', {}, env);

        expect(response.status).toBe(200);
        expect(security(response)).toEqual(SECURITY);
    });

    it('are on an answer to a signed-in user', async () => {
        const response = await send(ana, 'GET', '/expenses');

        expect(response.status).toBe(200);
        expect(security(response)).toEqual(SECURITY);
    });

    it('are on a write', async () => {
        const response = await send(ana, 'PUT', '/profile', { nickname: 'Anita' });

        expect(response.status).toBe(200);
        expect(security(response)).toEqual(SECURITY);
    });

    it('are on a 401', async () => {
        const response = await app.request('/api/expenses', {}, env);

        expect(response.status).toBe(401);
        expect(security(response)).toEqual(SECURITY);
    });

    it('are on a 400', async () => {
        const response = await send(ana, 'PUT', '/groups/not-an-id', {});

        expect(response.status).toBe(400);
        expect(security(response)).toEqual(SECURITY);
    });

    it('are on a path the Worker does not know', async () => {
        const response = await app.request('/api/nothing-here', {}, env);

        expect(response.status).toBe(404);
        expect(security(response)).toEqual(SECURITY);
    });

    it('are on the error page of Better Auth', async () => {
        const response = await app.request('/api/auth/error?error=SOMETHING', {}, env);

        expect(response.status).toBe(200);
        expect(security(response)).toEqual(SECURITY);
    });

    it('leave the one page of Better Auth nothing to load but its own style', async () => {
        const response = await app.request('/api/auth/error?error=SOMETHING', {}, env);
        const page = await response.text();

        expect(response.headers.get('content-type')).toContain('text/html');
        expect(page).toContain('<style>');
        expect(page).not.toMatch(/<(script|link|img|iframe|object|embed|form|base)\b/i);
        expect(page).not.toMatch(/\son[a-z]+\s*=/i);
    });

    it('are on a session answer of Better Auth', async () => {
        const response = await app.request('/api/auth/get-session', { headers: ana.headers }, env);

        expect(response.status).toBe(200);
        expect(security(response)).toEqual(SECURITY);
    });

    it('are on the redirect Better Auth answers when a sign-in comes back broken', async () => {
        const response = await app.request(
            '/api/auth/callback/google?code=made-up&state=made-up',
            { headers: { origin: ORIGIN } },
            env
        );

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).not.toBeNull();
        expect(security(response)).toEqual(SECURITY);
    });

    it('are on an answer whose headers cannot be changed', async () => {
        const unchangeable = new Hono()
            .use(withSecurityHeaders)
            .get('/', () => Response.redirect(`${ORIGIN}/elsewhere`, 302));

        const response = await unchangeable.request('/');

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(`${ORIGIN}/elsewhere`);
        expect(security(response)).toEqual(SECURITY);
    });

    it('keep every cookie an answer sets, one by one', async () => {
        const cookies = new Hono()
            .use(withSecurityHeaders)
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
            expect(security(response)).toEqual(SECURITY);
        }
    });

    it('keep the headers the answer had', async () => {
        const response = await app.request('/api/health', {}, env);

        expect(response.headers.get('content-type')).toContain('application/json');
        expect(await response.json()).toEqual({ ok: true });
    });
});
