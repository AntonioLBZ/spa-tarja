import { getMigrations } from 'better-auth/db/migration';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { authOptions } from '@server/auth';
import { befriend, makeGroup, send } from '@server/test/groups';
import { ORIGIN, cachedSession, sentAs, signIn, type TestSession } from '@server/test/session';

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

    it('sends a failed sign-in started from an invitation back to that invitation', async () => {
        const path = `/join/${crypto.randomUUID()}.${'A'.repeat(43)}`;
        const started = await post('/api/auth/sign-in/social', {
            provider: 'google',
            callbackURL: path,
            errorCallbackURL: `${path}?signin=failed`,
        });
        expect(started.status).toBe(200);
        const { url } = (await started.json()) as { url: string };
        const state = new URL(url).searchParams.get('state');
        const cookie = started.headers
            .getSetCookie()
            .map((line) => line.split(';')[0])
            .join('; ');

        const back = await request(`/api/auth/callback/google?state=${state}&error=access_denied`, {
            headers: { cookie },
        });

        expect(back.status).toBe(302);
        expect(back.headers.get('location')).toBe(`${path}?signin=failed&error=access_denied`);
    });

    it('refuses an error address on another site', async () => {
        const response = await post('/api/auth/sign-in/social', {
            provider: 'google',
            callbackURL: '/',
            errorCallbackURL: 'https://evil.example/?signin=failed',
        });

        expect(response.status).toBe(403);
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

describe('a user deleted while the session is cached', () => {
    async function goneWithCache() {
        const cached = await cachedSession(session);
        await env.DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(session.userId).run();
        return cached;
    }

    async function rows(table: string) {
        const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
        return row?.n;
    }

    it('trusts the cached session of a user who is there, as it does for a few minutes', async () => {
        const cached = await cachedSession(session);
        await env.DB.prepare('DELETE FROM "session" WHERE "userId" = ?1').bind(session.userId).run();

        expect((await request('/api/expenses', asSession({}, cached))).status).toBe(200);
    });

    it.each(['/api/expenses', '/api/categories', '/api/income', '/api/budgets', '/api/profile', '/api/groups'])(
        'answers 401 on %s',
        async (path) => {
            const cached = await goneWithCache();

            expect((await request(path, asSession({}, cached))).status).toBe(401);
        }
    );

    it('answers 401 to a write of an expense, and nothing is written', async () => {
        const cached = await goneWithCache();
        const expense = {
            categoryId: 'food',
            text: 'Lunch',
            amountCents: 1250,
            currency: 'EUR',
            date: '2026-10-25',
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
        };

        const response = await send(cached, 'PUT', `/expenses/${crypto.randomUUID()}`, expense);

        expect(response.status).toBe(401);
        expect(await rows('expenses')).toBe(0);
    });

    it('answers 401 to a nickname, and nothing is written', async () => {
        const cached = await goneWithCache();

        const response = await send(cached, 'PUT', '/profile', { nickname: 'Anita' });

        expect(response.status).toBe(401);
        expect(await rows('profile')).toBe(0);
    });

    it('answers 401 to making a group, and nothing is made', async () => {
        const cached = await goneWithCache();
        const body = { kind: 'group', name: 'Trip', currency: 'EUR', me: { id: crypto.randomUUID() }, others: [] };

        const response = await send(cached, 'PUT', `/groups/${crypto.randomUUID()}`, body);

        expect(response.status).toBe(401);
        expect(await rows('shared_groups')).toBe(0);
    });

    it('answers 401 to adding a friend to a group', async () => {
        const bruno = await signIn('bruno@example.com', 'Bruno');
        const group = await makeGroup(session);
        const friend = await befriend(session, bruno);
        const cached = await goneWithCache();

        const response = await send(cached, 'PUT', `/groups/${group.id}/members/${crypto.randomUUID()}`, {
            friend: friend.id,
        });

        expect(response.status).toBe(401);
        expect(await rows('shared_members')).toBe(3);
    });

    it('answers 401 to reading the entries of a group', async () => {
        const group = await makeGroup(session);
        const cached = await goneWithCache();

        const response = await send(cached, 'GET', `/groups/${group.id}/entries`);

        expect(response.status).toBe(401);
    });

    it('answers 401 to writing an entry of a group, and nothing is written', async () => {
        const group = await makeGroup(session, ['Dan']);
        const dan = group.members.find((member) => member.id !== group.me)!;
        const cached = await goneWithCache();
        const settlement = {
            kind: 'settlement',
            text: '',
            amountCents: 500,
            currency: 'EUR',
            date: '2026-10-26',
            paidBy: dan.id,
            shares: [{ memberId: group.me, cents: 500 }],
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
        };

        const response = await send(cached, 'PUT', `/groups/${group.id}/entries/${crypto.randomUUID()}`, settlement);

        expect(response.status).toBe(401);
        expect(await rows('shared_entries')).toBe(0);
    });

    it('answers 401 to removing a member of a group, and nobody is removed', async () => {
        const group = await makeGroup(session, ['Dan']);
        const dan = group.members.find((member) => member.id !== group.me)!;
        const cached = await goneWithCache();

        const response = await send(cached, 'DELETE', `/groups/${group.id}/members/${dan.id}`);

        expect(response.status).toBe(401);
        expect(await rows('shared_members')).toBe(2);
    });

    it.each(['read', 'accept', 'decline'])('answers 401 to %s a link', async (action) => {
        const bruno = await signIn('bruno@example.com', 'Bruno');
        const link = (await (await send(bruno, 'POST', '/invitations')).json()) as { invitation: { token: string } };
        const cached = await goneWithCache();

        const response = await send(cached, 'POST', `/invitations/${action}`, { token: link.invitation.token });

        expect(response.status).toBe(401);
    });
});

describe('a window opened for another user', () => {
    let bruno: TestSession;

    beforeEach(async () => {
        bruno = await signIn('bruno@example.com', 'Bruno');
    });

    async function rows(table: string) {
        const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
        return row?.n;
    }

    it('serves a window opened for the user of the session', async () => {
        const response = await send(sentAs(session, session.userId), 'GET', '/expenses');

        expect(response.status).toBe(200);
    });

    it('serves a request that names nobody, like curl or an older app', async () => {
        const response = await send(session, 'GET', '/expenses');

        expect(response.status).toBe(200);
    });

    it.each(['/expenses', '/categories', '/income', '/budgets', '/profile', '/groups'])(
        'answers 401 other-user on %s',
        async (path) => {
            const response = await send(sentAs(bruno, session.userId), 'GET', path);

            expect(response.status).toBe(401);
            expect(await response.json()).toEqual({ error: 'other-user' });
        }
    );

    it('answers 401 other-user on a group route, and reads nothing of the group', async () => {
        const group = await makeGroup(bruno);

        const response = await send(sentAs(bruno, session.userId), 'GET', `/groups/${group.id}/entries`);

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'other-user' });
    });

    it('answers 401 other-user to a write of an expense, and nothing is written', async () => {
        const expense = {
            categoryId: 'food',
            text: 'Lunch',
            amountCents: 1250,
            currency: 'EUR',
            date: '2026-10-25',
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
        };

        const response = await send(sentAs(bruno, session.userId), 'PUT', `/expenses/${crypto.randomUUID()}`, expense);

        expect(response.status).toBe(401);
        expect(await rows('expenses')).toBe(0);
    });

    it('answers 401 other-user to making a group, and nothing is made', async () => {
        const body = { kind: 'group', name: 'Trip', currency: 'EUR', me: { id: crypto.randomUUID() }, others: [] };

        const response = await send(sentAs(bruno, session.userId), 'PUT', `/groups/${crypto.randomUUID()}`, body);

        expect(response.status).toBe(401);
        expect(await rows('shared_groups')).toBe(0);
    });

    it('answers 401 other-user to an empty name', async () => {
        const response = await send(sentAs(session, ''), 'GET', '/expenses');

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'other-user' });
    });

    it('answers unauthorized, not other-user, when the account of the session is gone', async () => {
        const cached = await cachedSession(session);
        await env.DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(session.userId).run();

        const response = await send(sentAs(cached, bruno.userId), 'GET', '/expenses');

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'unauthorized' });
    });

    it('leaves the session routes alone: the window may ask who is signed in whoever it was opened for', async () => {
        const response = await send(sentAs(bruno, session.userId), 'GET', '/auth/get-session');

        expect(response.status).toBe(200);
        expect(((await response.json()) as { user: { id: string } }).user.id).toBe(bruno.userId);
    });

    it('does not ask for the user on the health check', async () => {
        const response = await send(sentAs(bruno, session.userId), 'GET', '/health');

        expect(response.status).toBe(200);
    });
});

describe('the schema', () => {
    it('has every table and column Better Auth needs', async () => {
        const { toBeCreated, toBeAdded } = await getMigrations(authOptions(env, ORIGIN));

        expect(toBeCreated).toEqual([]);
        expect(toBeAdded).toEqual([]);
    });
});
