import { getMigrations } from 'better-auth/db/migration';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { authOptions } from '@server/auth';
import { ORIGIN, signIn, type TestSession } from '@server/test/session';

let session: TestSession;

beforeEach(async () => {
    session = await signIn();
});

function request(path: string, init: RequestInit = {}) {
    return app.request(path, init, env);
}

function asSession(init: RequestInit = {}, as: TestSession = session): RequestInit {
    const headers = new Headers(as.headers);
    for (const [name, value] of new Headers(init.headers)) headers.set(name, value);
    return { ...init, headers };
}

function post(path: string, body: unknown, headers: Record<string, string> = {}, as?: TestSession) {
    return request(
        path,
        asSession(
            {
                method: 'POST',
                headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
                body: JSON.stringify(body),
            },
            as
        )
    );
}

describe('access to the data', () => {
    it.each(['/api/expenses', '/api/categories', '/api/income'])('answers 401 to a visitor on %s', async (path) => {
        const response = await request(path);

        expect(response.status).toBe(401);
    });

    it('answers 401 to a write from a visitor', async () => {
        const response = await request(`/api/categories/${crypto.randomUUID()}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Gym' }),
        });

        expect(response.status).toBe(401);
    });

    it('answers 401 to a cookie that is not a session', async () => {
        const response = await request('/api/expenses', {
            headers: { cookie: 'better-auth.session_token=made-up.value' },
        });

        expect(response.status).toBe(401);
    });

    it('serves a signed-in user', async () => {
        const response = await request('/api/expenses', asSession());

        expect(response.status).toBe(200);
    });

    it('keeps each user’s data apart', async () => {
        const other = await signIn('ben@example.com');
        await request(
            `/api/categories/${crypto.randomUUID()}`,
            asSession({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"name":"Gym"}' })
        );

        const theirs = await request('/api/categories', asSession({}, other));
        const mine = await request('/api/categories', asSession());

        expect(await theirs.json()).toEqual({ categories: [] });
        expect(((await mine.json()) as { categories: unknown[] }).categories).toHaveLength(1);
    });
});

describe('/api/auth', () => {
    it('has no session for a visitor', async () => {
        const response = await request('/api/auth/get-session');

        expect(response.status).toBe(200);
        expect(await response.json()).toBeNull();
    });

    it('tells who is signed in', async () => {
        const response = await request('/api/auth/get-session', asSession());

        const body = (await response.json()) as { user: { id: string; email: string } };
        expect(body.user).toMatchObject({ id: session.userId, email: 'ana@example.com' });
    });

    it('starts the Google sign-in from the origin of the request', async () => {
        const response = await post('/api/auth/sign-in/social', { provider: 'google', callbackURL: '/' });

        expect(response.status).toBe(200);
        const { url } = (await response.json()) as { url: string };
        const google = new URL(url);
        expect(google.host).toBe('accounts.google.com');
        expect(google.searchParams.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
        expect(google.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/callback/google`);
    });

    it('refuses to send the person to another site once signed in', async () => {
        const response = await post('/api/auth/sign-in/social', {
            provider: 'google',
            callbackURL: 'https://evil.example/',
        });

        expect(response.status).toBe(403);
    });

    it('refuses a sign-out that comes from another origin', async () => {
        const response = await post('/api/auth/sign-out', {}, { origin: 'https://evil.example' });

        expect(response.status).toBe(403);
        const still = await request('/api/auth/get-session', asSession());
        expect(await still.json()).not.toBeNull();
    });

    it('ends the session on sign-out', async () => {
        const response = await post('/api/auth/sign-out', {});

        expect(response.status).toBe(200);
        const after = await request('/api/auth/get-session', asSession());
        expect(await after.json()).toBeNull();
        expect((await request('/api/expenses', asSession())).status).toBe(401);
    });
});

describe('the schema', () => {
    it('has every table and column Better Auth needs', async () => {
        const { toBeCreated, toBeAdded } = await getMigrations(authOptions(env, ORIGIN));

        expect(toBeCreated).toEqual([]);
        expect(toBeAdded).toEqual([]);
    });
});
