import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { memberBalances } from '@core/balance';
import { INVITATION_DAYS, isInvitationToken, type FriendInvitation } from '@core/invitation';
import { MAX_FRIENDS, type SharedGroup } from '@core/shared-group';
import { signInvitation } from '@server/invitation-token';
import { befriend, groupOf, listGroups, makeFriend, makeGroup, seedEntry, send } from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

import type { SharedEntry } from '@core/shared-entry';

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

async function invitationIn(response: Response): Promise<FriendInvitation | null> {
    expect(response.status).toBe(200);
    return ((await response.json()) as { invitation: FriendInvitation | null }).invitation;
}

async function error(response: Response, status: number) {
    expect(response.status).toBe(status);
    return ((await response.json()) as { error: string }).error;
}

function listInvitation(as: TestSession, friendId: string) {
    return send(as, 'GET', `/groups/${friendId}/invitations`);
}

function invite(as: TestSession, friendId: string) {
    return send(as, 'POST', `/groups/${friendId}/invitations`);
}

function revoke(as: TestSession, friendId: string) {
    return send(as, 'DELETE', `/groups/${friendId}/invitations`);
}

// The link of a new invitation for that friend
async function linkOf(as: TestSession, friendId: string): Promise<string> {
    const invitation = await invitationIn(await invite(as, friendId));
    if (invitation?.state !== 'open') throw new Error('No open invitation');
    return invitation.token;
}

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function respelled(token: string) {
    const next = BASE64URL[BASE64URL.indexOf(token.slice(-1)) + 1] ?? '';
    return `${token.slice(0, -1)}${next}`;
}

function readLink(as: TestSession, token: string) {
    return send(as, 'POST', '/invitations/read', { token });
}

function accept(as: TestSession, token: string) {
    return send(as, 'POST', '/invitations/accept', { token });
}

function decline(as: TestSession, token: string) {
    return send(as, 'POST', '/invitations/decline', { token });
}

function dummyOf(friend: SharedGroup): string {
    return friend.members.find((member) => member.id !== friend.me)?.id ?? '';
}

// A friend of Ana's by name and the link she made for it
async function invitedFriend(name = 'Bruno') {
    const friend = await makeFriend(ana, name);
    return { friend, dummy: dummyOf(friend), token: await linkOf(ana, friend.id) };
}

async function entriesOf(as: TestSession, groupId: string): Promise<SharedEntry[]> {
    const response = await send(as, 'GET', `/groups/${groupId}/entries`);
    expect(response.status).toBe(200);
    return ((await response.json()) as { entries: SharedEntry[] }).entries;
}

async function storedRows() {
    const { results } = await env.DB.prepare('SELECT * FROM friend_invitations').all<Record<string, unknown>>();
    return results;
}

describe('making an invitation', () => {
    it('answers the open link of a friend whose other side is a dummy, for 14 days', async () => {
        const friend = await makeFriend(ana);
        const before = Date.now();

        const invitation = await invitationIn(await invite(ana, friend.id));

        expect(invitation).toMatchObject({ state: 'open' });
        if (invitation?.state !== 'open') return;
        expect(isInvitationToken(invitation.token)).toBe(true);
        expect(invitation.expiresAt).toBeGreaterThanOrEqual(before + INVITATION_DAYS * DAY);
        expect(invitation.expiresAt).toBeLessThanOrEqual(Date.now() + INVITATION_DAYS * DAY);
    });

    it('lists the same link again', async () => {
        const friend = await makeFriend(ana);
        const made = await invitationIn(await invite(ana, friend.id));

        expect(await invitationIn(await listInvitation(ana, friend.id))).toEqual(made);
    });

    it('revokes the open link when another is made', async () => {
        const friend = await makeFriend(ana);
        const first = await linkOf(ana, friend.id);

        const second = await linkOf(ana, friend.id);

        expect(second).not.toBe(first);
        expect(await invitationIn(await listInvitation(ana, friend.id))).toMatchObject({ token: second });
        const rows = await storedRows();
        expect(rows.find((row) => first.startsWith(`${String(row.id)}.`))?.revoked_at).toEqual(expect.any(Number));
        expect(rows.filter((row) => row.revoked_at === null)).toHaveLength(1);
    });

    it('keeps no part of the signature in the database', async () => {
        const friend = await makeFriend(ana);
        const token = await linkOf(ana, friend.id);
        const [id, signature = ''] = token.split('.');

        const rows = await storedRows();

        expect(rows).toEqual([expect.objectContaining({ id, group_id: friend.id, created_by: ana.userId })]);
        expect(JSON.stringify(rows)).not.toContain(signature);
    });

    it('is for the dummy of the friend', async () => {
        const friend = await makeFriend(ana);
        const dummy = friend.members.find((member) => member.id !== friend.me);

        await linkOf(ana, friend.id);

        expect(await storedRows()).toEqual([expect.objectContaining({ member_id: dummy?.id })]);
    });

    it('is refused to anybody who is not in the friend, as if it did not exist', async () => {
        const friend = await makeFriend(ana);
        await linkOf(ana, friend.id);

        expect(await error(await invite(carla, friend.id), 404)).toBe('not-found');
        expect(await error(await listInvitation(carla, friend.id), 404)).toBe('not-found');
        expect(await error(await revoke(carla, friend.id), 404)).toBe('not-found');
        expect((await storedRows()).filter((row) => row.revoked_at === null)).toHaveLength(1);
    });

    it('is refused for a group, which takes no invitations', async () => {
        const group = await makeGroup(ana, ['Bruno']);

        expect(await error(await invite(ana, group.id), 409)).toBe('not-a-friend');
        expect(await invitationIn(await listInvitation(ana, group.id))).toBeNull();
        expect(await storedRows()).toEqual([]);
    });

    it('is refused once the friend is a person, on either side', async () => {
        const friend = await befriend(ana, bruno);

        expect(await error(await invite(ana, friend.id), 409)).toBe('not-placeholder');
        expect(await error(await invite(bruno, friend.id), 409)).toBe('not-placeholder');
        expect(await invitationIn(await listInvitation(ana, friend.id))).toBeNull();
    });

    it('is refused for a friend that was removed, whose open link is gone with it', async () => {
        const friend = await makeFriend(ana);
        await linkOf(ana, friend.id);
        await groupOf(await send(ana, 'DELETE', `/groups/${friend.id}`));

        expect(await error(await invite(ana, friend.id), 409)).toBe('closed');
        expect(await invitationIn(await listInvitation(ana, friend.id))).toBeNull();
        expect(await invitationIn(await revoke(ana, friend.id))).toBeNull();
    });

    it('needs a session', async () => {
        const friend = await makeFriend(ana);
        const anonymous = { userId: '', headers: new Headers() };

        expect(await error(await invite(anonymous, friend.id), 401)).toBe('unauthorized');
        expect(await error(await listInvitation(anonymous, friend.id), 401)).toBe('unauthorized');
        expect(await error(await revoke(anonymous, friend.id), 401)).toBe('unauthorized');
    });
});

describe('what carries a link', () => {
    it('is never kept by a cache', async () => {
        const friend = await makeFriend(ana);
        const made = await invite(ana, friend.id);
        const token = await linkOf(ana, friend.id);

        const answers = [
            made,
            await listInvitation(ana, friend.id),
            await revoke(ana, friend.id),
            await readLink(bruno, token),
            await accept(bruno, token),
            await decline(bruno, token),
        ];

        expect(answers.map((response) => response.headers.get('cache-control'))).toEqual(answers.map(() => 'no-store'));
    });
});

describe('the open link of a friend', () => {
    it('is listed until it expires, and then no more', async () => {
        const friend = await makeFriend(ana);
        const token = await linkOf(ana, friend.id);

        vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + INVITATION_DAYS * DAY - 60_000 });
        expect(await invitationIn(await listInvitation(ana, friend.id))).toMatchObject({ token });

        vi.setSystemTime(Date.now() + 120_000);
        expect(await invitationIn(await listInvitation(ana, friend.id))).toBeNull();
    });

    it('is taken away by revoking it, which can be sent again', async () => {
        const friend = await makeFriend(ana);
        await linkOf(ana, friend.id);

        expect(await invitationIn(await revoke(ana, friend.id))).toBeNull();
        expect(await invitationIn(await listInvitation(ana, friend.id))).toBeNull();
        expect(await invitationIn(await revoke(ana, friend.id))).toBeNull();
        expect(await storedRows()).toEqual([expect.objectContaining({ revoked_at: expect.any(Number) })]);
    });

    it('is nothing for a friend that never had one', async () => {
        const friend = await makeFriend(ana);

        expect(await invitationIn(await listInvitation(ana, friend.id))).toBeNull();
    });
});

describe('opening a link', () => {
    it('shows only the name of who asks: their nickname', async () => {
        await send(ana, 'PUT', '/profile', { nickname: 'Anita' });
        const { token } = await invitedFriend();

        const response = await readLink(bruno, token);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ name: 'Anita' });
    });

    it('or else the name of their account, never their email', async () => {
        const { token } = await invitedFriend();

        const response = await readLink(bruno, token);

        expect(response.status).toBe(200);
        const text = await response.text();
        expect(JSON.parse(text)).toEqual({ name: 'Ana García' });
        expect(text).not.toContain('example.com');
    });

    it('changes nothing', async () => {
        const { friend, token } = await invitedFriend();

        await readLink(bruno, token);

        expect(await invitationIn(await listInvitation(ana, friend.id))).toMatchObject({ state: 'open', token });
    });

    it('needs a session, as accepting and declining do', async () => {
        const { token } = await invitedFriend();
        const anonymous = { userId: '', headers: new Headers() };

        for (const response of [readLink, accept, decline].map((call) => call(anonymous, token))) {
            expect(await error(await response, 401)).toBe('unauthorized');
        }
    });

    it('refuses a body without a token', async () => {
        expect((await send(bruno, 'POST', '/invitations/read', {})).status).toBe(400);
        expect((await send(bruno, 'POST', '/invitations/accept', { token: 7 })).status).toBe(400);
    });
});

describe('a link that cannot be used', () => {
    const cases: Array<[string, () => Promise<string>]> = [
        ['that was never made', () => signInvitation(env.BETTER_AUTH_SECRET, crypto.randomUUID())],
        [
            'signed with another secret',
            async () => {
                const { token } = await invitedFriend();
                return signInvitation('another-secret-that-is-long-enough', token.slice(0, 36));
            },
        ],
        ['with a signature made up', async () => `${(await invitedFriend()).token.slice(0, 36)}.${'A'.repeat(43)}`],
        ['of another shape', async () => 'nonsense'],
        [
            'spelled another way, which decodes to the same signature',
            async () => respelled((await invitedFriend()).token),
        ],
        [
            'that was revoked',
            async () => {
                const { friend, token } = await invitedFriend();
                await revoke(ana, friend.id);
                return token;
            },
        ],
        [
            'that another link replaced',
            async () => {
                const { friend, token } = await invitedFriend();
                await linkOf(ana, friend.id);
                return token;
            },
        ],
        [
            'that somebody else used',
            async () => {
                const { token } = await invitedFriend();
                await groupOf(await accept(carla, token));
                return token;
            },
        ],
        [
            'that was declined',
            async () => {
                const { token } = await invitedFriend();
                expect((await decline(carla, token)).status).toBe(204);
                return token;
            },
        ],
        [
            'of a friend that was removed',
            async () => {
                const { friend, token } = await invitedFriend();
                await groupOf(await send(ana, 'DELETE', `/groups/${friend.id}`));
                return token;
            },
        ],
        [
            'of a dummy that was claimed',
            async () => {
                const { dummy, token } = await invitedFriend();
                await env.DB.prepare('UPDATE shared_members SET claimed_at = 1 WHERE id = ?1').bind(dummy).run();
                return token;
            },
        ],
        [
            'of a dummy that was merged into another member',
            async () => {
                const { friend, dummy, token } = await invitedFriend();
                await env.DB.prepare('UPDATE shared_members SET merged_into = ?2 WHERE id = ?1')
                    .bind(dummy, friend.me)
                    .run();
                return token;
            },
        ],
        [
            'of a dummy that left',
            async () => {
                const { dummy, token } = await invitedFriend();
                await env.DB.prepare('UPDATE shared_members SET left_at = 1 WHERE id = ?1').bind(dummy).run();
                return token;
            },
        ],
        [
            'of a dummy that is a user',
            async () => {
                const { dummy, token } = await invitedFriend();
                await env.DB.batch([
                    env.DB.prepare('PRAGMA ignore_check_constraints = ON'),
                    env.DB.prepare('UPDATE shared_members SET user_id = ?2 WHERE id = ?1').bind(dummy, carla.userId),
                    env.DB.prepare('PRAGMA ignore_check_constraints = OFF'),
                ]);
                return token;
            },
        ],
        [
            'of a person who deleted their account',
            async () => {
                const { token } = await invitedFriend();
                await env.DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(ana.userId).run();
                return token;
            },
        ],
    ];

    it.each(cases)('answers the same 410 when it is a link %s', async (_, make) => {
        const token = await make();

        for (const call of [readLink, accept, decline]) {
            const response = await call(bruno, token);
            expect(response.status).toBe(410);
            expect(await response.json()).toEqual({ error: 'gone' });
        }
    });

    it('answers 410 once it has expired, and not a moment before', async () => {
        const { token } = await invitedFriend();

        vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + INVITATION_DAYS * DAY - 60_000 });
        expect((await readLink(bruno, token)).status).toBe(200);

        vi.setSystemTime(Date.now() + 120_000);
        for (const call of [readLink, accept, decline]) {
            expect(await error(await call(bruno, token), 410)).toBe('gone');
        }
    });

    it('tells the person who made it that it is their own, and stays open', async () => {
        const { friend, token } = await invitedFriend();

        for (const call of [readLink, accept, decline]) {
            expect(await error(await call(ana, token), 409)).toBe('yourself');
        }
        expect(await invitationIn(await listInvitation(ana, friend.id))).toMatchObject({ state: 'open', token });
    });
});

describe('accepting', () => {
    it('makes the person the friend in place of the dummy, under their own name', async () => {
        await send(bruno, 'PUT', '/profile', { nickname: 'Bru' });
        const { friend, dummy, token } = await invitedFriend('Mi hermano');

        const joined = await groupOf(await accept(bruno, token));

        expect(joined).toMatchObject({ id: friend.id, kind: 'direct', me: dummy, closed: null });
        expect(joined.members.map(({ id, name, claimed }) => ({ id, name, claimed }))).toEqual([
            { id: friend.me, name: 'Ana García', claimed: true },
            { id: dummy, name: 'Bru', claimed: true },
        ]);
        const anasFriend = (await listGroups(ana)).find((group) => group.id === friend.id);
        expect(anasFriend?.members.find((member) => member.id === dummy)).toMatchObject({ name: 'Bru', claimed: true });
    });

    it('keeps everything shared with the dummy, with the same balances, and rewrites nothing', async () => {
        const { friend, dummy, token } = await invitedFriend();
        await seedEntry(friend.id, { paidBy: friend.me, shares: { [friend.me]: 1000, [dummy]: 2000 } });
        await seedEntry(friend.id, { paidBy: dummy, shares: { [friend.me]: 500 }, kind: 'settlement' });
        const before = await entriesOf(ana, friend.id);

        const joined = await groupOf(await accept(bruno, token));

        expect(await entriesOf(bruno, friend.id)).toEqual(before);
        expect(await entriesOf(ana, friend.id)).toEqual(before);
        expect(memberBalances(before, joined.members)).toEqual(
            expect.arrayContaining([
                { memberId: friend.me, cents: 1500 },
                { memberId: dummy, cents: -1500 },
            ])
        );
    });

    it('answers the friend again to the same person, and serves nobody else', async () => {
        const { token } = await invitedFriend();
        const joined = await groupOf(await accept(bruno, token));

        expect(await groupOf(await accept(bruno, token))).toEqual(joined);
        expect(await error(await accept(carla, token), 410)).toBe('gone');
        expect(await error(await readLink(bruno, token), 410)).toBe('gone');
    });

    it('serves one person when two accept at the same moment', async () => {
        const { friend, dummy, token } = await invitedFriend();

        const responses = await Promise.all([accept(bruno, token), accept(carla, token)]);

        expect(responses.map((response) => response.status).sort()).toEqual([200, 410]);
        const winner = responses[0]?.status === 200 ? bruno : carla;
        const claimed = await env.DB.prepare('SELECT user_id FROM shared_members WHERE id = ?1').bind(dummy).first();
        expect(claimed).toEqual({ user_id: winner.userId });
        expect(await storedRows()).toEqual([
            expect.objectContaining({ group_id: friend.id, accepted_by: winner.userId }),
        ]);
    });

    it('makes one friend when two links of the same person are accepted at the same moment', async () => {
        const first = await invitedFriend('Bruno');
        const second = await invitedFriend('Bruno D.');

        const responses = await Promise.all([accept(bruno, first.token), accept(bruno, second.token)]);

        expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
        const refused = responses.find((response) => response.status === 409);
        expect(await refused?.json()).toEqual({ error: 'already-friends' });
        expect((await listGroups(bruno)).filter((group) => group.kind === 'direct')).toHaveLength(1);
    });

    it('refuses two people who are friends already, and leaves the link open', async () => {
        await befriend(ana, bruno);
        const { friend, token } = await invitedFriend();

        expect(await error(await accept(bruno, token), 409)).toBe('already-friends');
        expect(await invitationIn(await listInvitation(ana, friend.id))).toMatchObject({ state: 'open', token });
    });

    it('takes two people whose friend was removed', async () => {
        const old = await befriend(ana, bruno);
        await groupOf(await send(ana, 'DELETE', `/groups/${old.id}`));
        const { token } = await invitedFriend();

        expect((await accept(bruno, token)).status).toBe(200);
    });

    it('refuses a person who has as many friends as there can be', async () => {
        const { token } = await invitedFriend();
        const statements = Array.from({ length: MAX_FRIENDS }, () => {
            const groupId = crypto.randomUUID();
            return [
                env.DB.prepare(
                    `INSERT INTO shared_groups (id, kind, currency, created_by, created_at, updated_at)
                     VALUES (?1, 'direct', 'EUR', ?2, 1, 1)`
                ).bind(groupId, bruno.userId),
                env.DB.prepare(
                    `INSERT INTO shared_members (id, group_id, user_id, name, role, created_at, claimed_at)
                     VALUES (?1, ?2, ?3, 'Bruno', 'owner', 1, 1)`
                ).bind(crypto.randomUUID(), groupId, bruno.userId),
            ];
        });
        await env.DB.batch(statements.flat());

        expect(await error(await accept(bruno, token), 409)).toBe('too-many-friends');
    });

    it('either wins over a revoke at the same moment or loses to it, never half', async () => {
        const { friend, dummy, token } = await invitedFriend();

        const [accepted] = await Promise.all([accept(bruno, token), revoke(ana, friend.id)]);

        const member = await env.DB.prepare('SELECT user_id FROM shared_members WHERE id = ?1').bind(dummy).first();
        const [row] = await storedRows();
        if (accepted.status === 200) {
            expect(member).toEqual({ user_id: bruno.userId });
            expect(row).toMatchObject({ accepted_by: bruno.userId, revoked_at: null });
        } else {
            expect(accepted.status).toBe(410);
            expect(member).toEqual({ user_id: null });
            expect(row).toMatchObject({ accepted_by: null, revoked_at: expect.any(Number) });
        }
    });
});

describe('declining', () => {
    it('ends the link, which the person who made it reads as declined', async () => {
        const { friend, dummy, token } = await invitedFriend();

        expect((await decline(bruno, token)).status).toBe(204);

        expect(await invitationIn(await listInvitation(ana, friend.id))).toEqual({ state: 'declined' });
        expect(await error(await readLink(bruno, token), 410)).toBe('gone');
        expect((await listGroups(ana)).find((group) => group.id === friend.id)?.members).toContainEqual(
            expect.objectContaining({ id: dummy, claimed: false })
        );
    });

    it('keeps nothing of the person who declined', async () => {
        const { token } = await invitedFriend();

        await decline(bruno, token);

        expect(JSON.stringify(await storedRows())).not.toContain(bruno.userId);
    });

    it('lets the person who asked make another link', async () => {
        const { friend, token } = await invitedFriend();
        await decline(bruno, token);

        const another = await linkOf(ana, friend.id);

        expect(await invitationIn(await listInvitation(ana, friend.id))).toMatchObject({ token: another });
        expect((await readLink(bruno, another)).status).toBe(200);
    });
});
