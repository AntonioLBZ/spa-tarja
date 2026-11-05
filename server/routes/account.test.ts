import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_CLOSED_GROUPS } from '@core/shared-group';
import { app } from '@server/app';
import {
    befriend,
    claim,
    groupOf,
    listGroups,
    makeFriend,
    makeGroup,
    memberNamed,
    seedClosedGroups,
    seedEntry,
    send,
} from '@server/test/groups';
import { cachedSession, sentAs, signIn, signInAgain, type TestSession } from '@server/test/session';

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

async function linkOf(as: TestSession, friendId: string) {
    const response = await send(as, 'POST', `/groups/${friendId}/invitations`);
    return ((await response.json()) as { invitation: { token: string } }).invitation.token;
}

async function sharedRows() {
    const read = async (table: string) => (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results;
    return Promise.all(['shared_groups', 'shared_members', 'shared_entries', 'friend_invitations'].map(read));
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
        await linkOf(ana, (await makeFriend(ana, 'Dan')).id);
        const before = [await rowsOf(ana.userId), await sharedRows()];
        await env.DB.prepare(
            `CREATE TRIGGER refuse_user_delete BEFORE DELETE ON "user" BEGIN SELECT RAISE(ABORT, 'refused'); END`
        ).run();

        try {
            const response = await deleteAccount(ana);

            expect(response.status).toBe(500);
            expect([await rowsOf(ana.userId), await sharedRows()]).toEqual(before);
        } finally {
            await env.DB.prepare('DROP TRIGGER refuse_user_delete').run();
        }
    });
});

describe('the groups of a deleted account', () => {
    let carla: TestSession;
    let eva: TestSession;

    beforeEach(async () => {
        carla = await signIn('carla@example.com', 'Carla');
        eva = await signIn('eva@example.com', 'Eva');
    });

    function dinner(paidBy: string, shares: Record<string, number>) {
        const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
        return {
            kind: 'expense',
            text: 'Dinner',
            categoryId: 'food',
            amountCents: list.reduce((sum, share) => sum + share.cents, 0),
            currency: 'EUR',
            date: '2026-10-25',
            paidBy,
            split: 'exact',
            shares: list,
            createdAt: 1_000,
            updatedAt: 1_000,
            deletedAt: null,
        };
    }

    function settlement(paidBy: string, to: string, cents: number) {
        return {
            kind: 'settlement',
            text: '',
            amountCents: cents,
            currency: 'EUR',
            date: '2026-10-26',
            paidBy,
            shares: [{ memberId: to, cents }],
            createdAt: 2_000,
            updatedAt: 2_000,
            deletedAt: null,
        };
    }

    async function joinAt(memberId: string, as: TestSession, claimedAt: number) {
        await env.DB.prepare(
            `UPDATE shared_members SET user_id = ?2, claimed_at = ?3, name = (SELECT name FROM "user" WHERE id = ?2)
             WHERE id = ?1`
        )
            .bind(memberId, as.userId, claimedAt)
            .run();
    }

    async function leftAt(memberId: string) {
        await env.DB.prepare('UPDATE shared_members SET left_at = 5, left_seq = 0 WHERE id = ?1').bind(memberId).run();
    }

    async function membersOf(groupId: string) {
        const { results } = await env.DB.prepare(
            'SELECT id, user_id, name, role FROM shared_members WHERE group_id = ?1 ORDER BY created_at, id'
        )
            .bind(groupId)
            .all<{ id: string; user_id: string | null; name: string; role: string }>();
        return results;
    }

    async function isClosed(groupId: string) {
        const row = await env.DB.prepare('SELECT deleted_at FROM shared_groups WHERE id = ?1')
            .bind(groupId)
            .first<{ deleted_at: number | null }>();
        return row?.deleted_at !== null;
    }

    async function ownerOf(groupId: string) {
        return (await membersOf(groupId)).find((member) => member.role === 'owner')?.id ?? null;
    }

    async function rowsOfGroup(groupId: string) {
        const read = async (sql: string) => (await env.DB.prepare(sql).bind(groupId).all()).results;
        return {
            group: await read('SELECT * FROM shared_groups WHERE id = ?1'),
            members: await read('SELECT * FROM shared_members WHERE group_id = ?1 ORDER BY id'),
            entries: await read('SELECT * FROM shared_entries WHERE group_id = ?1 ORDER BY seq'),
            invitations: await read('SELECT * FROM friend_invitations WHERE group_id = ?1 ORDER BY id'),
        };
    }

    it('keeps every entry of the others as it was, with the member and the writer no longer anybody', async () => {
        const trip = await makeGroup(bruno, ['Ana', 'Dan']);
        const anaId = memberNamed(trip, 'Ana');
        const dan = memberNamed(trip, 'Dan');
        await claim(anaId, ana);
        const written = await send(
            ana,
            'PUT',
            `/groups/${trip.id}/entries/${crypto.randomUUID()}`,
            dinner(anaId, { [anaId]: 1000, [trip.me]: 1000, [dan]: 1000 })
        );
        expect(written.status).toBe(200);
        await seedEntry(trip.id, { paidBy: trip.me, shares: { [anaId]: 500, [trip.me]: 500 } });
        const before = await rowsOfGroup(trip.id);

        await deleteAccount(ana);

        const after = await rowsOfGroup(trip.id);
        expect(after.entries).toEqual(
            before.entries.map((entry) => ({
                ...entry,
                created_by: entry.created_by === ana.userId ? null : entry.created_by,
                updated_by: entry.updated_by === ana.userId ? null : entry.updated_by,
            }))
        );
        const [group] = await listGroups(bruno);
        expect(group?.closed).toBeNull();
        expect(group?.members.find((member) => member.id === anaId)).toEqual({
            id: anaId,
            name: '',
            role: 'member',
            claimed: true,
            leftAt: null,
            mergedInto: null,
        });
        const ledger = await send(bruno, 'GET', `/groups/${trip.id}/entries`);
        expect(ledger.status).toBe(200);
        const { entries } = (await ledger.json()) as { entries: Array<{ paidBy: string; createdBy: string | null }> };
        expect(entries.find((entry) => entry.paidBy === anaId)?.createdBy).toBeNull();
    });

    it('lets the others settle what that member owed, and remove them once it is zero', async () => {
        const trip = await makeGroup(bruno, ['Ana']);
        const anaId = memberNamed(trip, 'Ana');
        await claim(anaId, ana);
        await seedEntry(trip.id, { paidBy: trip.me, shares: { [anaId]: 1500 } });

        await deleteAccount(ana);

        const remove = () => send(bruno, 'DELETE', `/groups/${trip.id}/members/${anaId}`);
        expect((await remove()).status).toBe(409);
        const settled = await send(
            bruno,
            'PUT',
            `/groups/${trip.id}/entries/${crypto.randomUUID()}`,
            settlement(anaId, trip.me, 1500)
        );
        expect(settled.status).toBe(200);
        await groupOf(await remove());
    });

    it('hands a group they owned to the user who joined first and is still in it', async () => {
        const trip = await makeGroup(ana, ['Carla', 'Bruno', 'Eva', 'Dan']);
        const [carlaId, brunoId, evaId] = ['Carla', 'Bruno', 'Eva'].map((name) => memberNamed(trip, name));
        await joinAt(carlaId!, carla, 10);
        await joinAt(brunoId!, bruno, 30);
        await joinAt(evaId!, eva, 20);
        await leftAt(carlaId!);

        await deleteAccount(ana);

        expect(await isClosed(trip.id)).toBe(false);
        expect(await ownerOf(trip.id)).toBe(evaId);
        expect((await membersOf(trip.id)).find((member) => member.id === trip.me)).toEqual({
            id: trip.me,
            user_id: null,
            name: '',
            role: 'member',
        });
        const [seen] = await listGroups(eva);
        expect(seen?.members.find((member) => member.id === evaId)?.role).toBe('owner');
    });

    it('hands a group over to a user who is at the limit of closed groups, and closes the ones nobody else uses', async () => {
        const trip = await makeGroup(ana, ['Bruno']);
        const deserted = await makeGroup(ana, ['Dan']);
        const brunoId = memberNamed(trip, 'Bruno');
        await joinAt(brunoId, bruno, 10);
        await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS);

        const response = await deleteAccount(ana);

        expect(response.status).toBe(204);
        expect(await isClosed(trip.id)).toBe(false);
        expect(await ownerOf(trip.id)).toBe(brunoId);
        expect(await isClosed(deserted.id)).toBe(true);
    });

    it('closes a group they owned where nobody else uses the app, and leaves it with no owner', async () => {
        const dummies = await makeGroup(ana, ['Dan']);
        const deserted = await makeGroup(ana, ['Bruno']);
        const brunoId = memberNamed(deserted, 'Bruno');
        await joinAt(brunoId, bruno, 10);
        await leftAt(brunoId);

        await deleteAccount(ana);

        for (const group of [dummies, deserted]) {
            expect(await isClosed(group.id)).toBe(true);
            expect(await ownerOf(group.id)).toBeNull();
        }
        const [seen] = await listGroups(bruno);
        expect(seen?.closed).toBe('left');
    });

    it('closes a friend whose other side is a dummy, and revokes its open link', async () => {
        const friend = await makeFriend(ana, 'Dan');
        const token = await linkOf(ana, friend.id);

        await deleteAccount(ana);

        expect(await isClosed(friend.id)).toBe(true);
        const [invitation] = (await rowsOfGroup(friend.id)).invitations;
        expect(invitation).toMatchObject({ created_by: null, accepted_at: null });
        expect(invitation?.revoked_at).not.toBeNull();
        expect((await send(bruno, 'POST', '/invitations/read', { token })).status).toBe(410);
    });

    it('keeps a friend with somebody who uses the app open, and that person owns it', async () => {
        const made = await befriend(ana, bruno);
        const joined = await befriend(carla, ana);

        await deleteAccount(ana);

        expect(await isClosed(made.id)).toBe(false);
        expect(await ownerOf(made.id)).toBe(made.b);
        expect(await isClosed(joined.id)).toBe(false);
        expect(await ownerOf(joined.id)).toBe(joined.a);
        const [friend] = await listGroups(bruno);
        expect(friend?.members.find((member) => member.id === made.a)).toMatchObject({ name: '', role: 'member' });
    });

    it('closes a friend whose other side had deleted their account before', async () => {
        const friend = await befriend(bruno, ana);
        await deleteAccount(bruno, 'bruno@example.com');
        expect(await isClosed(friend.id)).toBe(false);
        expect(await ownerOf(friend.id)).toBe(friend.b);

        await deleteAccount(ana);

        expect(await isClosed(friend.id)).toBe(true);
        expect(await ownerOf(friend.id)).toBeNull();
        expect((await membersOf(friend.id)).map((member) => [member.user_id, member.name])).toEqual([
            [null, ''],
            [null, ''],
        ]);
    });

    it('keeps an invitation they accepted as accepted, by nobody', async () => {
        const friend = await makeFriend(bruno, 'Ana');
        expect((await send(ana, 'POST', '/invitations/accept', { token: await linkOf(bruno, friend.id) })).status).toBe(
            200
        );

        await deleteAccount(ana);

        const [invitation] = (await rowsOfGroup(friend.id)).invitations;
        expect(invitation).toMatchObject({ accepted_by: null, revoked_at: null });
        expect(invitation?.accepted_at).not.toBeNull();
        expect(await isClosed(friend.id)).toBe(false);
    });

    it('names them nowhere in the shared tables, and leaves no owner without a user', async () => {
        const trip = await makeGroup(ana, ['Bruno', 'Dan']);
        await claim(memberNamed(trip, 'Bruno'), bruno);
        await send(
            ana,
            'PUT',
            `/groups/${trip.id}/entries/${crypto.randomUUID()}`,
            dinner(trip.me, { [trip.me]: 900 })
        );
        await linkOf(ana, (await makeFriend(ana, 'Dan')).id);
        const theirs = await makeFriend(carla, 'Ana');
        await send(ana, 'POST', '/invitations/accept', { token: await linkOf(carla, theirs.id) });
        await makeGroup(ana);

        await deleteAccount(ana);

        const named = await env.DB.prepare(
            `SELECT (SELECT COUNT(*) FROM shared_groups WHERE created_by = ?1)
                + (SELECT COUNT(*) FROM shared_members WHERE user_id = ?1 OR created_by = ?1)
                + (SELECT COUNT(*) FROM shared_entries WHERE created_by = ?1 OR updated_by = ?1)
                + (SELECT COUNT(*) FROM friend_invitations WHERE created_by = ?1 OR accepted_by = ?1) AS n`
        )
            .bind(ana.userId)
            .first<{ n: number }>();
        expect(named?.n).toBe(0);
        const owners = await env.DB.prepare(
            "SELECT COUNT(*) AS n FROM shared_members WHERE role = 'owner' AND user_id IS NULL"
        ).first<{ n: number }>();
        expect(owners?.n).toBe(0);
    });

    it('leaves every group they are not in as it was, and the open links of others open', async () => {
        const trip = await makeGroup(bruno, ['Carla', 'Dan']);
        await claim(memberNamed(trip, 'Carla'), carla);
        await seedEntry(trip.id, { paidBy: trip.me, shares: { [memberNamed(trip, 'Carla')]: 700 } });
        const friend = await befriend(bruno, carla);
        const waiting = await makeFriend(bruno, 'Ana');
        await linkOf(bruno, waiting.id);
        const ids = [trip.id, friend.id, waiting.id];
        const before = await Promise.all(ids.map(rowsOfGroup));

        await deleteAccount(ana);

        const after = await Promise.all(ids.map(rowsOfGroup));
        expect(after).toEqual(before);
        expect(after[2]?.invitations).toHaveLength(1);
        expect(after[2]?.invitations[0]).toMatchObject({ created_by: bruno.userId, revoked_at: null });
    });

    it('hands a closed group to the user who joined first, and keeps every closed group as it was', async () => {
        const trip = await makeGroup(ana, ['Carla', 'Bruno']);
        const [carlaId, brunoId] = ['Carla', 'Bruno'].map((name) => memberNamed(trip, name));
        await joinAt(carlaId!, carla, 20);
        await joinAt(brunoId!, bruno, 10);
        const deserted = await makeGroup(ana, ['Dan']);
        for (const id of [trip.id, deserted.id]) {
            await env.DB.prepare('UPDATE shared_groups SET deleted_at = 5, updated_at = 5 WHERE id = ?1')
                .bind(id)
                .run();
        }

        await deleteAccount(ana);

        for (const id of [trip.id, deserted.id]) {
            expect((await rowsOfGroup(id)).group[0]).toMatchObject({ deleted_at: 5, updated_at: 5 });
        }
        expect(await ownerOf(trip.id)).toBe(brunoId);
        expect(await ownerOf(deserted.id)).toBeNull();
    });

    it('breaks a tie between members who joined at the same time by their id, not by their user', async () => {
        const smaller = '00000000-0000-4000-8000-000000000001';
        const larger = '00000000-0000-4000-8000-000000000002';
        const body = {
            kind: 'group',
            name: 'Trip',
            currency: 'EUR',
            me: { id: crypto.randomUUID() },
            others: [
                { id: larger, name: 'Carla' },
                { id: smaller, name: 'Bruno' },
            ],
        };
        const trip = await groupOf(await send(ana, 'PUT', `/groups/${crypto.randomUUID()}`, body));
        const [low, high] = [carla, bruno].sort((a, b) => (a.userId < b.userId ? -1 : 1));
        await joinAt(larger, low!, 10);
        await joinAt(smaller, high!, 10);

        await deleteAccount(ana);

        expect(await ownerOf(trip.id)).toBe(smaller);
    });

    it('leaves a group they had left as it was, without closing it or handing it over', async () => {
        const trip = await makeGroup(bruno, ['Ana', 'Dan']);
        const anaId = memberNamed(trip, 'Ana');
        await claim(anaId, ana);
        await leftAt(anaId);
        await leftAt(trip.me);
        const before = await rowsOfGroup(trip.id);

        await deleteAccount(ana);

        const after = await rowsOfGroup(trip.id);
        expect(after.group).toEqual(before.group);
        expect(await ownerOf(trip.id)).toBe(before.members.find((member) => member.role === 'owner')?.id);
    });
});
