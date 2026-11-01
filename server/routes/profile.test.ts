import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { NICKNAME_MAX_LENGTH } from '@core/profile';
import { app } from '@server/app';
import { signIn, type TestSession } from '@server/test/session';

let session: TestSession;

beforeEach(async () => {
    session = await signIn();
});

function putRaw(body: string, as: TestSession = session) {
    const headers = new Headers(as.headers);
    headers.set('content-type', 'application/json');
    return app.request('/api/profile', { method: 'PUT', headers, body }, env);
}

function put(body: unknown, as: TestSession = session) {
    return putRaw(JSON.stringify(body), as);
}

async function read(as: TestSession = session) {
    const response = await app.request('/api/profile', { headers: as.headers }, env);
    expect(response.status).toBe(200);
    return response.json();
}

async function rowsOf(userId: string) {
    const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM profile WHERE user_id = ?1').bind(userId).first();
    return row?.n;
}

describe('without a session', () => {
    it('answers 401 to a read and to a write', async () => {
        expect((await app.request('/api/profile', {}, env)).status).toBe(401);
        const write = await app.request(
            '/api/profile',
            {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ nickname: 'Ana' }),
            },
            env
        );
        expect(write.status).toBe(401);
    });
});

describe('GET /api/profile', () => {
    it('starts with no nickname, and the name of the account to stand in for it', async () => {
        expect(await read()).toEqual({ nickname: null, name: 'Ana' });
    });

    it('never tells the email', async () => {
        await put({ nickname: 'Anita' });

        const response = await app.request('/api/profile', { headers: session.headers }, env);

        expect(Object.keys(await response.clone().json()).sort()).toEqual(['name', 'nickname']);
        expect(await response.text()).not.toContain('ana@example.com');
    });
});

describe('PUT /api/profile', () => {
    it('sets the nickname, trimmed, and answers with the profile', async () => {
        const response = await put({ nickname: '  Anita ' });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ nickname: 'Anita', name: 'Ana' });
        expect(await read()).toEqual({ nickname: 'Anita', name: 'Ana' });
    });

    it('replaces the nickname there was', async () => {
        await put({ nickname: 'Anita' });

        await put({ nickname: 'La Ana' });

        expect(await read()).toEqual({ nickname: 'La Ana', name: 'Ana' });
        expect(await rowsOf(session.userId)).toBe(1);
    });

    it('takes the nickname away with null, and keeps no row for it', async () => {
        await put({ nickname: 'Anita' });

        const response = await put({ nickname: null });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ nickname: null, name: 'Ana' });
        expect(await read()).toEqual({ nickname: null, name: 'Ana' });
        expect(await rowsOf(session.userId)).toBe(0);
    });

    it('ignores any field but the nickname, so the name of the account can’t be changed this way', async () => {
        const response = await put({ nickname: 'Anita', name: 'Mallory', email: 'mallory@example.com' });

        expect(response.status).toBe(200);
        expect(await read()).toEqual({ nickname: 'Anita', name: 'Ana' });
        const user = await env.DB.prepare('SELECT name, email FROM "user" WHERE id = ?1').bind(session.userId).first();
        expect(user).toEqual({ name: 'Ana', email: 'ana@example.com' });
    });

    it('answers the same to null when there was no nickname', async () => {
        const response = await put({ nickname: null });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ nickname: null, name: 'Ana' });
    });

    it('lets two people have the same nickname', async () => {
        const other = await signIn('ben@example.com');
        await put({ nickname: 'Anita' }, other);

        const response = await put({ nickname: 'Anita' });

        expect(response.status).toBe(200);
        expect(await read(other)).toEqual({ nickname: 'Anita', name: 'Ana' });
    });

    it('leaves the nickname of somebody else alone', async () => {
        const other = await signIn('ben@example.com');
        await put({ nickname: 'Benny' }, other);

        await put({ nickname: 'Anita' });
        await put({ nickname: null });

        expect(await read(other)).toEqual({ nickname: 'Benny', name: 'Ana' });
    });

    it.each([
        ['an empty nickname', { nickname: '' }],
        ['a nickname of only spaces', { nickname: '   ' }],
        ['a nickname with nothing visible in it', { nickname: '\u200B\u2060' }],
        ['a nickname that is too long', { nickname: 'x'.repeat(NICKNAME_MAX_LENGTH + 1) }],
        ['a nickname that is a number', { nickname: 7 }],
        ['a nickname that is a boolean', { nickname: true }],
        ['a nickname that is a list', { nickname: ['Ana'] }],
        ['a nickname that is an object', { nickname: { text: 'Ana' } }],
        ['no nickname at all', {}],
        ['a body that is a bare string', 'Ana'],
        ['a body that is null', null],
        ['a body that is a list', [{ nickname: 'Ana' }]],
    ])('rejects %s and keeps the one there was', async (_, body) => {
        await put({ nickname: 'Anita' });

        const response = await put(body);

        expect(response.status).toBe(400);
        expect(await read()).toEqual({ nickname: 'Anita', name: 'Ana' });
    });

    it.each([
        ['a body that is not JSON', 'nickname=Ana'],
        ['a body cut short', '{"nickname": "Ana"'],
        ['an empty body', ''],
    ])('rejects %s and keeps the one there was', async (_, body) => {
        await put({ nickname: 'Anita' });

        const response = await putRaw(body);

        expect(response.status).toBe(400);
        expect(await read()).toEqual({ nickname: 'Anita', name: 'Ana' });
    });
});
