import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { INVITATION_DAYS, isInvitationToken, type FriendInvitation } from '@core/invitation';
import { befriend, groupOf, makeFriend, makeGroup, send } from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

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
