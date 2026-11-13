import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENDED_INVITATION_DAYS, INVITATION_DAYS, isInvitationToken, type PendingInvitation } from '@core/invitation';
import { MAX_CLOSED_GROUPS, MAX_FRIENDS, MAX_OPEN_GROUPS, MAX_OPEN_INVITATIONS } from '@core/shared-group';
import { app } from '@server/app';
import { signInvitation } from '@server/invitation-token';
import { befriend, groupOf, listGroups, makeGroup, memberNamed, seedClosedGroups, send } from '@server/test/groups';
import { sentAs, signIn, type TestSession } from '@server/test/session';

const DAY = 24 * 60 * 60 * 1000;

let ana: TestSession;
let bruno: TestSession;
let carla: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
    carla = await signIn('carla@example.com', 'Carla Ruiz');
});

afterEach(() => {
    vi.useRealTimers();
});

async function error(response: Response, status: number) {
    expect(response.status).toBe(status);
    return ((await response.json()) as { error: string }).error;
}

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function respelled(token: string) {
    const next = BASE64URL[BASE64URL.indexOf(token.slice(-1)) + 1] ?? '';
    return `${token.slice(0, -1)}${next}`;
}

function readLink(as: TestSession, token: unknown) {
    return send(as, 'POST', '/invitations/read', { token });
}

function accept(as: TestSession, token: unknown) {
    return send(as, 'POST', '/invitations/accept', { token });
}

function decline(as: TestSession, token: unknown) {
    return send(as, 'POST', '/invitations/decline', { token });
}

function makeLink(as: TestSession) {
    return send(as, 'POST', '/invitations');
}

function listLinks(as: TestSession) {
    return send(as, 'GET', '/invitations');
}

function revokeLink(as: TestSession, id: string) {
    return send(as, 'DELETE', `/invitations/${id}`);
}

async function linkMade(as: TestSession): Promise<PendingInvitation> {
    const response = await makeLink(as);
    expect(response.status).toBe(200);
    return ((await response.json()) as { invitation: PendingInvitation }).invitation;
}

async function pendingIn(response: Response): Promise<PendingInvitation[]> {
    expect(response.status).toBe(200);
    return ((await response.json()) as { invitations: PendingInvitation[] }).invitations;
}

async function seedFriends(userId: string, count: number) {
    const statements = Array.from({ length: count }, () => {
        const groupId = crypto.randomUUID();
        return [
            env.DB.prepare(
                `INSERT INTO shared_groups (id, kind, currency, created_by, created_at, updated_at)
                 VALUES (?1, 'direct', 'EUR', ?2, 1, 1)`
            ).bind(groupId, userId),
            env.DB.prepare(
                `INSERT INTO shared_members (id, group_id, user_id, name, role, created_at, claimed_at)
                 VALUES (?1, ?2, ?3, 'Someone', 'owner', 1, 1)`
            ).bind(crypto.randomUUID(), groupId, userId),
        ];
    });
    await env.DB.batch(statements.flat());
}

async function storedRows() {
    const { results } = await env.DB.prepare('SELECT * FROM friend_invitations').all<Record<string, unknown>>();
    return results;
}

describe('making a link to be friends', () => {
    it('is made for 14 days, as a link whose id names a row with no friend until it is accepted', async () => {
        const before = Date.now();

        const made = await linkMade(ana);

        expect(isInvitationToken(made.token)).toBe(true);
        expect(made.token.startsWith(`${made.id}.`)).toBe(true);
        expect(made.expiresAt).toBeGreaterThanOrEqual(before + INVITATION_DAYS * DAY);
        expect(made.expiresAt).toBeLessThanOrEqual(Date.now() + INVITATION_DAYS * DAY);
        expect(await storedRows()).toEqual([
            expect.objectContaining({ id: made.id, group_id: null, created_by: ana.userId }),
        ]);
        expect(JSON.stringify(await storedRows())).not.toContain(made.token.slice(37));
    });

    it('is listed to whoever made it, newest first, with the token to copy it again', async () => {
        const first = await linkMade(ana);
        const second = await linkMade(ana);

        expect(await pendingIn(await listLinks(ana))).toEqual([second, first]);
    });

    it('is listed to nobody else', async () => {
        await linkMade(ana);

        expect(await pendingIn(await listLinks(bruno))).toEqual([]);
        expect(await pendingIn(await listLinks(carla))).toEqual([]);
    });

    it('leaves the list once it is revoked, and revoking it again changes nothing', async () => {
        const first = await linkMade(ana);
        const second = await linkMade(ana);

        expect(await pendingIn(await revokeLink(ana, first.id))).toEqual([second]);
        expect(await pendingIn(await revokeLink(ana, first.id))).toEqual([second]);
        expect(await error(await readLink(bruno, first.token), 410)).toBe('gone');
    });

    it('leaves the list once it expires, and not a moment before', async () => {
        const made = await linkMade(ana);

        vi.useFakeTimers({ toFake: ['Date'], now: made.expiresAt - 1 });
        expect(await pendingIn(await listLinks(ana))).toEqual([made]);
        vi.setSystemTime(made.expiresAt);
        expect(await pendingIn(await listLinks(ana))).toEqual([]);
    });

    it('is revoked by nobody but who made it, who gets the same answer as for a link that does not exist', async () => {
        const made = await linkMade(ana);

        const answers = [await revokeLink(bruno, made.id), await revokeLink(bruno, crypto.randomUUID())];

        expect(answers.map((answer) => answer.status)).toEqual([404, 404]);
        const bodies = await Promise.all(answers.map((answer) => answer.text()));
        expect(new Set(bodies)).toEqual(new Set([JSON.stringify({ error: 'not-found' })]));
        expect(await pendingIn(await listLinks(ana))).toEqual([made]);
    });

    it('takes an id in any case, and nothing but an id', async () => {
        const made = await linkMade(ana);

        expect((await revokeLink(ana, 'nonsense')).status).toBe(400);
        expect(await pendingIn(await revokeLink(ana, made.id.toUpperCase()))).toEqual([]);
    });

    it(`is refused past ${MAX_OPEN_INVITATIONS} open ones, and a revoked or expired one frees its place`, async () => {
        const made = await Promise.all(Array.from({ length: MAX_OPEN_INVITATIONS + 5 }, () => makeLink(ana)));

        expect(made.filter((response) => response.status === 200)).toHaveLength(MAX_OPEN_INVITATIONS);
        const refused = made.filter((response) => response.status !== 200);
        expect(await Promise.all(refused.map((response) => error(response, 409)))).toEqual(
            refused.map(() => 'too-many-invitations')
        );
        const [newest] = await pendingIn(await listLinks(ana));
        await revokeLink(ana, newest?.id ?? '');
        await linkMade(ana);
        expect(await error(await makeLink(ana), 409)).toBe('too-many-invitations');
        vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + INVITATION_DAYS * DAY });
        await linkMade(ana);
    });

    it(`deletes the own links that ended over ${ENDED_INVITATION_DAYS} days ago when the person makes another`, async () => {
        const now = Date.now();
        const ago = (days: number) => now - days * DAY;
        const age = async (id: string, columns: Record<string, number>) => {
            const names = Object.keys(columns);
            await env.DB.prepare(
                `UPDATE friend_invitations SET ${names.map((name, i) => `${name} = ?${i + 2}`).join(', ')} WHERE id = ?1`
            )
                .bind(id, ...Object.values(columns))
                .run();
        };
        const expired = async (as: TestSession, createdDays: number, expiresDays: number) => {
            const { id } = await linkMade(as);
            await age(id, { created_at: ago(createdDays), expires_at: ago(expiresDays) });
            return id;
        };
        const revoked = async (as: TestSession, createdDays: number, expiresDays: number, revokedDays: number) => {
            const { id } = await linkMade(as);
            await revokeLink(as, id);
            await age(id, { created_at: ago(createdDays), expires_at: ago(expiresDays), revoked_at: ago(revokedDays) });
            return id;
        };
        const gone = [
            await revoked(ana, 100, 86, 90),
            await revoked(ana, 40, 26, 33),
            await expired(ana, 60, 46),
            await expired(ana, 45, 31),
            await (async () => {
                const link = await linkMade(ana);
                await decline(bruno, link.token);
                await age(link.id, { created_at: ago(60), expires_at: ago(46), declined_at: ago(50) });
                return link.id;
            })(),
        ];
        const accepted = await linkMade(ana);
        await accept(bruno, accepted.token);
        await age(accepted.id, { created_at: ago(100), expires_at: ago(86), accepted_at: ago(90) });
        const kept = [
            accepted.id,
            await revoked(ana, 10, -4, 5),
            await revoked(ana, 40, 26, 28),
            await expired(ana, 43, 29),
            (await linkMade(ana)).id,
            await expired(bruno, 100, 86),
        ];

        const made = await linkMade(ana);

        const rows = await storedRows();
        expect(rows.map((row) => row.id).sort()).toEqual([...kept, made.id].sort());
        for (const id of gone) expect(rows.map((row) => row.id)).not.toContain(id);
    });

    it('keeps a recently revoked link, which can be revoked again', async () => {
        const made = await linkMade(ana);
        await revokeLink(ana, made.id);

        await linkMade(ana);

        expect((await revokeLink(ana, made.id)).status).toBe(200);
    });

    it('is refused to a person who can take no more friends', async () => {
        await seedFriends(ana.userId, MAX_FRIENDS);
        await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS);

        expect(await error(await makeLink(ana), 409)).toBe('too-many-friends');
        expect(await error(await makeLink(bruno), 409)).toBe('too-many-closed-groups');
        expect(await storedRows()).toEqual([]);
    });

    it('is made again once a person archives the closed groups that count against them', async () => {
        const piled = await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS);
        expect(await error(await makeLink(bruno), 409)).toBe('too-many-closed-groups');

        await send(bruno, 'PUT', `/groups/${piled[0]}/me`, { archived: true });

        expect((await makeLink(bruno)).status).toBe(200);
    });

    it('needs a session, and the window of the user it was opened for', async () => {
        const made = await linkMade(ana);
        const anonymous = { userId: '', headers: new Headers() };
        const otherWindow = sentAs(ana, bruno.userId);

        for (const as of [anonymous, otherWindow]) {
            const answers = [await makeLink(as), await listLinks(as), await revokeLink(as, made.id)];
            expect(answers.map((answer) => answer.status)).toEqual([401, 401, 401]);
        }
        expect(await pendingIn(await listLinks(ana))).toEqual([made]);
    });

    it('is never kept by a cache, nor framed', async () => {
        const made = await makeLink(ana);
        const { invitation } = (await made.clone().json()) as { invitation: PendingInvitation };

        const answers = [made, await listLinks(ana), await revokeLink(ana, invitation.id)];

        for (const answer of answers) {
            expect(answer.headers.get('cache-control')).toBe('no-store');
            expect(answer.headers.get('x-frame-options')).toBe('DENY');
            expect(answer.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
        }
    });

    it('makes and shows no link without a secret to sign with', async () => {
        await linkMade(ana);
        const bare = { ...env, BETTER_AUTH_SECRET: '' };

        const answers = [
            await app.request('/api/invitations', { method: 'POST', headers: ana.headers }, bare),
            await app.request('/api/invitations', { headers: ana.headers }, bare),
        ];

        expect(answers.map((answer) => answer.status)).toEqual([500, 500]);
        expect((await Promise.all(answers.map((answer) => answer.text()))).join('')).not.toMatch(/\.[\w-]{43}/);
    });
});

describe('a link to be friends, opened by somebody', () => {
    async function linkOf(as = ana) {
        return (await linkMade(as)).token;
    }

    async function countRows(table: string) {
        return (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())?.n;
    }

    it('shows only the name of who asks: their nickname', async () => {
        await send(ana, 'PUT', '/profile', { nickname: 'Anita' });
        const token = await linkOf();

        const response = await readLink(bruno, token);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ name: 'Anita' });
    });

    it('or else their first name, never their email', async () => {
        const token = await linkOf();

        const response = await readLink(bruno, token);

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(JSON.parse(text)).toEqual({ name: 'Ana' });
        expect(text).not.toContain('example.com');
    });

    it('is only read when it is opened, which changes nothing', async () => {
        const token = await linkOf();

        await readLink(bruno, token);
        await readLink(carla, token);

        expect(await pendingIn(await listLinks(ana))).toEqual([expect.objectContaining({ token })]);
        expect(await countRows('shared_groups')).toBe(0);
    });

    it('needs a session to be read, accepted or declined', async () => {
        const token = await linkOf();
        const anonymous = { userId: '', headers: new Headers() };

        for (const response of [readLink, accept, decline].map((call) => call(anonymous, token))) {
            expect(await error(await response, 401)).toBe('unauthorized');
        }
    });

    it('answers 400 only when the body is not an object with a token key, as no link was asked about', async () => {
        for (const action of ['read', 'accept', 'decline']) {
            for (const body of [{}, [], 'nonsense']) {
                expect((await send(bruno, 'POST', `/invitations/${action}`, body)).status).toBe(400);
            }
        }
    });

    it('is never kept by a cache, whether it is read, accepted or declined', async () => {
        const token = await linkOf();

        const answers = [await readLink(bruno, token), await accept(bruno, token), await decline(carla, token)];

        expect(answers.map((response) => response.headers.get('cache-control'))).toEqual(answers.map(() => 'no-store'));
    });

    it('names each of the two after their nickname, else their first name', async () => {
        await send(bruno, 'PUT', '/profile', { nickname: 'Bru' });
        const token = await linkOf();

        const friend = await groupOf(await accept(bruno, token));

        expect(friend.members.map((member) => member.name)).toEqual(['Ana', 'Bru']);
    });

    it('makes the two friends once accepted, both people, in a friend of the app currency that who asked owns', async () => {
        const token = await linkOf();

        const friend = await groupOf(await accept(bruno, token));

        expect(friend).toMatchObject({ kind: 'direct', name: null, currency: 'EUR', closed: null, archived: false });
        expect(friend.members).toEqual([
            expect.objectContaining({ name: 'Ana', role: 'owner', claimed: true, leftAt: null }),
            expect.objectContaining({ id: friend.me, name: 'Bruno', role: 'member', claimed: true }),
        ]);
        const [seen] = await listGroups(ana);
        expect(seen).toEqual({ ...friend, me: friend.members[0]?.id });
        expect(await storedRows()).toEqual([
            expect.objectContaining({ group_id: friend.id, accepted_by: bruno.userId }),
        ]);
        expect(await pendingIn(await listLinks(ana))).toEqual([]);
    });

    it('answers the same friend again to the person who took it, and serves nobody else', async () => {
        const token = await linkOf();
        const friend = await groupOf(await accept(bruno, token));

        expect(await groupOf(await accept(bruno, token))).toEqual(friend);
        expect(await error(await accept(carla, token), 410)).toBe('gone');
        expect(await countRows('shared_groups')).toBe(1);
    });

    it('answers gone, as to anybody else, to the person who took it once the friend is closed for them', async () => {
        const token = await linkOf();
        const friend = await groupOf(await accept(bruno, token));
        await send(bruno, 'DELETE', `/groups/${friend.id}`);

        const again = await accept(bruno, token);

        expect(await error(again.clone(), 410)).toBe('gone');
        expect(await again.json()).toEqual(await (await accept(bruno, respelled(token))).json());
        expect(await error(await accept(carla, token), 410)).toBe('gone');
    });

    it('serves one person when two accept at the same moment, and makes no second friend', async () => {
        const token = await linkOf();

        const responses = await Promise.all([accept(bruno, token), accept(carla, token)]);

        expect(responses.map((response) => response.status).sort()).toEqual([200, 410]);
        expect(await countRows('shared_groups')).toBe(1);
        expect(await countRows('shared_members')).toBe(2);
        const winner = responses[0]?.status === 200 ? bruno : carla;
        expect(await storedRows()).toEqual([expect.objectContaining({ accepted_by: winner.userId })]);
    });

    it('makes one friend when two links of the same person are accepted at the same moment', async () => {
        const [first, second] = [await linkOf(), await linkOf()];

        const responses = await Promise.all([accept(bruno, first), accept(bruno, second)]);

        expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
        expect(await responses.find((response) => response.status === 409)?.json()).toEqual({
            error: 'already-friends',
        });
        expect(await countRows('shared_groups')).toBe(1);
        expect(await pendingIn(await listLinks(ana))).toHaveLength(1);
    });

    it('either wins over a revoke at the same moment or loses to it, never half', async () => {
        const made = await linkMade(ana);

        const [accepted] = await Promise.all([accept(bruno, made.token), revokeLink(ana, made.id)]);

        const [row] = await storedRows();
        if (accepted.status === 200) {
            expect(await countRows('shared_groups')).toBe(1);
            expect(row).toMatchObject({ accepted_by: bruno.userId, revoked_at: null });
        } else {
            expect(accepted.status).toBe(410);
            expect(await countRows('shared_groups')).toBe(0);
            expect(await countRows('shared_members')).toBe(0);
            expect(row).toMatchObject({ accepted_by: null, group_id: null, revoked_at: expect.any(Number) });
        }
    });

    it('refuses two people who are friends already, and leaves the link open', async () => {
        await befriend(ana, bruno);
        const token = await linkOf();

        expect(await error(await accept(bruno, token), 409)).toBe('already-friends');
        expect(await pendingIn(await listLinks(ana))).toHaveLength(1);
        expect(await countRows('shared_groups')).toBe(1);
    });

    it('takes two people whose friend was removed', async () => {
        const old = await befriend(ana, bruno);
        await groupOf(await send(ana, 'DELETE', `/groups/${old.id}`));
        const token = await linkOf();

        expect((await accept(bruno, token)).status).toBe(200);
    });

    it('takes two people who share a group but are not friends', async () => {
        const group = await makeGroup(ana);
        await groupOf(await send(ana, 'PUT', `/groups/${group.id}/members/${crypto.randomUUID()}`, { name: 'Bruno' }));
        const token = await linkOf();

        expect((await accept(bruno, token)).status).toBe(200);
    });

    it('tells the person who made it that it is their own, and stays open', async () => {
        const token = await linkOf();

        for (const call of [readLink, accept, decline]) {
            expect(await error(await call(ana, token), 409)).toBe('yourself');
        }
        expect(await pendingIn(await listLinks(ana))).toHaveLength(1);
    });

    const goneCases: Array<[string, () => Promise<unknown>]> = [
        [
            'revoked',
            async () => {
                const made = await linkMade(ana);
                await revokeLink(ana, made.id);
                return made.token;
            },
        ],
        [
            'used by somebody else',
            async () => {
                const token = await linkOf();
                await groupOf(await accept(carla, token));
                return token;
            },
        ],
        [
            'declined',
            async () => {
                const token = await linkOf();
                expect((await decline(carla, token)).status).toBe(204);
                return token;
            },
        ],
        [
            'of a person who deleted their account',
            async () => {
                const token = await linkOf();
                await send(ana, 'DELETE', '/account', { email: 'ana@example.com' });
                return token;
            },
        ],
        [
            'signed with another secret',
            async () => signInvitation('another-secret-that-is-long-enough', (await linkOf()).slice(0, 36)),
        ],
        ['that was never made', () => signInvitation(env.BETTER_AUTH_SECRET, crypto.randomUUID())],
        ['with a signature made up', async () => `${(await linkOf()).slice(0, 36)}.${'A'.repeat(43)}`],
        ['spelled another way', async () => respelled(await linkOf())],
        ['of another shape', async () => 'nonsense'],
        ['that is a number', async () => 7],
        ['that is null', async () => null],
        ['that is far too long', async () => 'x'.repeat(5000)],
    ];

    it.each(goneCases)('answers the same 410, byte for byte, when it was %s', async (_, make) => {
        const never = await readLink(bruno, await signInvitation(env.BETTER_AUTH_SECRET, crypto.randomUUID()));
        const expected = await never.text();
        const token = await make();
        const groups = await countRows('shared_groups');

        for (const call of [readLink, accept, decline]) {
            const response = await call(bruno, token);
            expect(response.status).toBe(410);
            expect(await response.text()).toBe(expected);
        }
        expect(await countRows('shared_groups')).toBe(groups);
    });

    it('answers 410 once it has expired, and not a moment before', async () => {
        const made = await linkMade(ana);

        vi.useFakeTimers({ toFake: ['Date'], now: made.expiresAt - 1 });
        expect((await readLink(bruno, made.token)).status).toBe(200);
        vi.setSystemTime(made.expiresAt);
        for (const call of [readLink, accept, decline]) {
            expect(await error(await call(bruno, made.token), 410)).toBe('gone');
        }
    });

    it('takes a person who has as many open groups as there can be, as groups and friends are counted apart', async () => {
        const token = await linkOf();
        for (let made = 0; made < MAX_OPEN_GROUPS; made++) await makeGroup(bruno);

        expect((await accept(bruno, token)).status).toBe(200);
    });

    it('is refused to a person who can take no more friends, with the limit that stops them', async () => {
        const token = await linkOf();
        await seedFriends(bruno.userId, MAX_FRIENDS);
        await seedClosedGroups(carla.userId, MAX_CLOSED_GROUPS);

        expect(await error(await accept(bruno, token), 409)).toBe('too-many-friends');
        expect(await error(await accept(carla, token), 409)).toBe('too-many-closed-groups');
        expect(await pendingIn(await listLinks(ana))).toHaveLength(1);
    });

    it.each([
        ['friends', (userId: string) => seedFriends(userId, MAX_FRIENDS)],
        ['closed groups', (userId: string) => seedClosedGroups(userId, MAX_CLOSED_GROUPS)],
    ])('is refused when who asks has as many %s as there can be, in the same words', async (_, fill) => {
        const token = await linkOf();
        await fill(ana.userId);
        const groups = await countRows('shared_groups');

        expect(await error(await accept(bruno, token), 409)).toBe('inviter-at-limit');
        expect(await countRows('shared_groups')).toBe(groups);
        expect(await pendingIn(await listLinks(ana))).toHaveLength(1);
    });

    it('is declined, which ends it, leaves the list of who made it and keeps nothing of who declined', async () => {
        const token = await linkOf();

        expect((await decline(bruno, token)).status).toBe(204);

        expect(await pendingIn(await listLinks(ana))).toEqual([]);
        expect(await countRows('shared_groups')).toBe(0);
        expect(await storedRows()).toEqual([expect.objectContaining({ declined_at: expect.any(Number) })]);
        expect(JSON.stringify(await storedRows())).not.toContain(bruno.userId);
    });

    it('is revoked when who made it deletes their account, and the friend it made no longer answers a second accept', async () => {
        const open = await linkOf();
        const used = await linkOf();
        const friend = await groupOf(await accept(bruno, used));

        expect((await send(ana, 'DELETE', '/account', { email: 'ana@example.com' })).status).toBe(204);

        expect(await error(await readLink(carla, open), 410)).toBe('gone');
        const rows = await storedRows();
        expect(rows.find((row) => open.startsWith(`${String(row.id)}.`))).toMatchObject({
            created_by: null,
            revoked_at: expect.any(Number),
        });
        expect(await error(await accept(bruno, used), 410)).toBe('gone');
        const [stays] = await listGroups(bruno);
        expect(stays).toMatchObject({ id: friend.id, closed: 'deleted' });
    });
});

describe('the invitations of a group', () => {
    it('are gone: a group has no routes to list, make or revoke them', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const path = `/groups/${group.id}/invitations`;

        const answers = [
            await send(ana, 'GET', path),
            await send(ana, 'POST', path),
            await send(ana, 'POST', path, { memberId: memberNamed(group, 'Bruno') }),
            await send(ana, 'DELETE', path),
            await send(ana, 'DELETE', `${path}/${crypto.randomUUID()}`),
        ];

        expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404, 404, 404]);
        expect(await storedRows()).toEqual([]);
    });
});
