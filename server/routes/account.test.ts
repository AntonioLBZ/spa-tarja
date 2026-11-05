import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { send } from '@server/test/groups';
import { cachedSession, signIn, signInAgain, type TestSession } from '@server/test/session';

// Where each table keeps the user a row belongs to
const OWN_ROWS = [
    ['"user"', 'id'],
    ['"session"', '"userId"'],
    ['"account"', '"userId"'],
    ['expenses', 'user_id'],
    ['categories', 'user_id'],
    ['income', 'user_id'],
    ['budget', 'user_id'],
    ['profile', 'user_id'],
] as const;

let ana: TestSession;
let bruno: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana');
    bruno = await signIn('bruno@example.com', 'Bruno');
    await seedOwnData(ana.userId);
    await seedOwnData(bruno.userId);
});

async function seedOwnData(userId: string) {
    await env.DB.batch([
        env.DB.prepare(
            `INSERT INTO expenses (id, user_id, category_id, text, amount_cents, currency, date, created_at, updated_at, seq)
             VALUES (?1, ?2, 'food', 'Lunch', 1250, 'EUR', '2026-10-25', 1, 1, 1)`
        ).bind(crypto.randomUUID(), userId),
        env.DB.prepare(
            `INSERT INTO categories (id, user_id, name, name_key, created_at) VALUES (?1, ?2, 'Gym', 'gym', 1)`
        ).bind(crypto.randomUUID(), userId),
        env.DB.prepare(
            `INSERT INTO income (user_id, month, amount_cents, currency, updated_at) VALUES (?1, '2026-10', 200000, 'EUR', 1)`
        ).bind(userId),
        env.DB.prepare(
            `INSERT INTO budget (user_id, month, scope, amount_cents, currency, updated_at)
             VALUES (?1, '2026-10', 'total', 150000, 'EUR', 1)`
        ).bind(userId),
        env.DB.prepare(`INSERT INTO profile (user_id, nickname, updated_at) VALUES (?1, 'Nick', 1)`).bind(userId),
        env.DB.prepare(
            `INSERT INTO "account" (id, "accountId", "providerId", "userId", "accessToken", "createdAt", "updatedAt")
             VALUES (?1, ?2, 'google', ?3, 'a-google-token', 1, 1)`
        ).bind(crypto.randomUUID(), crypto.randomUUID(), userId),
    ]);
}

async function rowsOf(userId: string) {
    return Promise.all(
        OWN_ROWS.map(async ([table, column]) => {
            const { results } = await env.DB.prepare(`SELECT * FROM ${table} WHERE ${column} = ?1 ORDER BY 1`)
                .bind(userId)
                .all();
            return results;
        })
    );
}

function deleteAccount(as: TestSession, email = 'ana@example.com') {
    return send(as, 'DELETE', '/account', { email });
}

describe('DELETE /api/account', () => {
    it('deletes the user, their sessions, their Google account and everything of their own, and answers nothing', async () => {
        await signInAgain(ana);
        expect((await rowsOf(ana.userId)).every((rows) => rows.length > 0)).toBe(true);

        const response = await deleteAccount(ana);

        expect(response.status).toBe(204);
        expect(await response.text()).toBe('');
        expect((await rowsOf(ana.userId)).flat()).toEqual([]);
    });

    it('leaves every row of anybody else as it was', async () => {
        const before = await rowsOf(bruno.userId);

        await deleteAccount(ana);

        expect(await rowsOf(bruno.userId)).toEqual(before);
        expect((await send(bruno, 'GET', '/expenses')).status).toBe(200);
    });

    it('expires the cookies of the session, so that the browser forgets them', async () => {
        const response = await deleteAccount(ana);

        const cookies = response.headers.getSetCookie();
        for (const name of ['better-auth.session_token', 'better-auth.session_data']) {
            const cookie = cookies.find((candidate) => candidate.startsWith(`${name}=`));
            expect(cookie).toMatch(new RegExp(`^${name}=;`));
            expect(cookie).toContain('Max-Age=0');
        }
    });

    it('ends every session at once: another device, a cached session and a second delete get 401', async () => {
        const phone = await signInAgain(ana);
        const cached = await cachedSession(phone);

        await deleteAccount(ana);

        expect((await send(phone, 'GET', '/expenses')).status).toBe(401);
        expect((await send(cached, 'GET', '/expenses')).status).toBe(401);
        expect((await deleteAccount(ana)).status).toBe(401);
        expect((await deleteAccount(cached)).status).toBe(401);
    });

    it('answers 401 to a visitor, and deletes nothing', async () => {
        const before = await rowsOf(ana.userId);
        const init = {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'ana@example.com' }),
        };

        const response = await app.request('/api/account', init, env);

        expect(response.status).toBe(401);
        expect(await rowsOf(ana.userId)).toEqual(before);
    });

    it('deletes nobody with an email that is not of the account, not even the one it names', async () => {
        const anas = await rowsOf(ana.userId);
        const brunos = await rowsOf(bruno.userId);

        const wrong = await deleteAccount(ana, 'bruno@example.com');
        const other = await deleteAccount(bruno, 'ana@example.com');

        expect(wrong.status).toBe(422);
        expect(await wrong.json()).toEqual({ error: 'wrong-email' });
        expect(other.status).toBe(422);
        expect(await rowsOf(ana.userId)).toEqual(anas);
        expect(await rowsOf(bruno.userId)).toEqual(brunos);
    });

    it('takes the email in another case and with spaces around it', async () => {
        const response = await deleteAccount(ana, '  ANA@example.com ');

        expect(response.status).toBe(204);
        expect((await rowsOf(ana.userId)).flat()).toEqual([]);
    });

    it('answers 400 to a body without an email, and deletes nothing', async () => {
        const before = await rowsOf(ana.userId);

        const response = await send(ana, 'DELETE', '/account', {});

        expect(response.status).toBe(400);
        expect(await rowsOf(ana.userId)).toEqual(before);
    });

    it('is all or nothing: when its last step fails, everything stays as it was', async () => {
        const before = await rowsOf(ana.userId);
        await env.DB.prepare(
            `CREATE TRIGGER refuse_user_delete BEFORE DELETE ON "user" BEGIN SELECT RAISE(ABORT, 'refused'); END`
        ).run();

        try {
            const response = await deleteAccount(ana);

            expect(response.status).toBe(500);
            expect(await rowsOf(ana.userId)).toEqual(before);
        } finally {
            await env.DB.prepare('DROP TRIGGER refuse_user_delete').run();
        }
    });
});
