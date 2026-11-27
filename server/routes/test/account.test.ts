import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '@server/app';
import { deleteAccount, rowsOf, seedOwnData, sharedRows } from '@server/testing/account';
import { befriend, claim, makeGroup, memberNamed, seedEntry, send } from '@server/testing/groups';
import { cachedSession, sentAs, signIn, signInAgain, type TestSession } from '@server/testing/session';

let ana: TestSession;
let bruno: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana');
    bruno = await signIn('bruno@example.com', 'Bruno');
    await seedOwnData(ana.userId);
    await seedOwnData(bruno.userId);
});

describe('DELETE /api/account', () => {
    it('deletes the user, their sessions, their Google account and everything of their own, and answers nothing', async () => {
        await signInAgain(ana);
        expect((await rowsOf(ana.userId)).every((rows) => rows.length > 0)).toBe(true);

        const response = await deleteAccount(ana);

        expect(response.status).toBe(204);
        expect(await response.text()).toBe('');
        expect((await rowsOf(ana.userId)).flat()).toEqual([]);
    });

    it('answers 204 when ending the cookies fails after the data is gone', async () => {
        let reads = 0;
        const brokenOnTheSecondRead = new Proxy(env, {
            get(target, property) {
                if (property === 'BETTER_AUTH_SECRET' && ++reads > 1) throw new Error('No more Better Auth');
                return Reflect.get(target, property);
            },
        });
        const headers = new Headers(ana.headers);
        headers.set('content-type', 'application/json');

        const response = await app.request(
            '/api/account',
            { method: 'DELETE', headers, body: JSON.stringify({ email: 'ana@example.com' }) },
            brokenOnTheSecondRead
        );

        expect(reads).toBe(2);
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
        expect(cookies).toHaveLength(3);
        expect(response.headers.get('x-frame-options')).toBe('DENY');
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

    it('deletes nothing from a window opened for another user, whose email it names', async () => {
        const before = await rowsOf(bruno.userId);

        const response = await deleteAccount(sentAs(bruno, ana.userId), 'bruno@example.com');

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'other-user' });
        expect(await rowsOf(bruno.userId)).toEqual(before);
        expect((await send(bruno, 'GET', '/expenses')).status).toBe(200);
    });

    it('deletes the account from a window opened for it', async () => {
        const response = await deleteAccount(sentAs(ana, ana.userId));

        expect(response.status).toBe(204);
        expect((await rowsOf(ana.userId)).flat()).toEqual([]);
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
        const trip = await makeGroup(ana, ['Bruno', 'Dan']);
        await claim(memberNamed(trip, 'Bruno'), bruno);
        await seedEntry(trip.id, { paidBy: trip.me, shares: { [memberNamed(trip, 'Bruno')]: 700 } });
        await befriend(ana, bruno);
        await send(ana, 'POST', '/invitations');
        const dummies = await makeGroup(ana, ['Mom', 'Mother'], 'Family');
        await env.DB.prepare('UPDATE shared_members SET merged_into = ?2 WHERE id = ?1')
            .bind(memberNamed(dummies, 'Mother'), memberNamed(dummies, 'Mom'))
            .run();
        await seedEntry(dummies.id, { paidBy: dummies.me, shares: { [memberNamed(dummies, 'Mom')]: 800 } });
        const before = [await rowsOf(ana.userId), await sharedRows()];
        await env.DB.prepare(
            `CREATE TRIGGER refuse_user_delete BEFORE DELETE ON "user" BEGIN SELECT RAISE(ABORT, 'refused'); END`
        ).run();
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const response = await deleteAccount(ana);

            expect(response.status).toBe(500);
            expect(logged).toHaveBeenCalledOnce();
            expect([await rowsOf(ana.userId), await sharedRows()]).toEqual(before);
        } finally {
            logged.mockRestore();
            await env.DB.prepare('DROP TRIGGER refuse_user_delete').run();
        }
    });
});
