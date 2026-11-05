import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { makeFriend } from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

import type { SharedGroup } from '@core/shared-group';

let ana: TestSession;
let friend: SharedGroup;
let dummy: string;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    friend = await makeFriend(ana);
    dummy = friend.members.find((member) => member.id !== friend.me)?.id ?? '';
});

interface Row {
    id?: string;
    groupId?: string;
    memberId?: string;
    createdAt?: number;
    expiresAt?: number;
    acceptedBy?: string | null;
    acceptedAt?: number | null;
    declinedAt?: number | null;
    revokedAt?: number | null;
}

function insert(row: Row = {}) {
    return env.DB.prepare(
        `INSERT INTO friend_invitations (id, group_id, member_id, created_by, created_at, expires_at, accepted_by,
            accepted_at, declined_at, revoked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`
    )
        .bind(
            row.id ?? crypto.randomUUID(),
            row.groupId ?? friend.id,
            row.memberId ?? dummy,
            ana.userId,
            row.createdAt ?? 1,
            row.expiresAt ?? 2,
            row.acceptedBy ?? null,
            row.acceptedAt ?? null,
            row.declinedAt ?? null,
            row.revokedAt ?? null
        )
        .run();
}

describe('the table of invitations', () => {
    it('holds one open invitation per friend, next to any number that ended', async () => {
        await insert({ revokedAt: 3 });
        await insert({ declinedAt: 3 });
        await insert({ acceptedAt: 3, acceptedBy: ana.userId });
        await insert();

        await expect(insert()).rejects.toThrow(/UNIQUE/);
    });

    it('lets another friend have an open one of its own', async () => {
        const other = await makeFriend(ana, 'Carla');
        const otherDummy = other.members.find((member) => member.id !== other.me)?.id ?? '';
        await insert();

        await insert({ groupId: other.id, memberId: otherDummy });

        const { results } = await env.DB.prepare('SELECT id FROM friend_invitations').all();
        expect(results).toHaveLength(2);
    });

    it.each([
        ['accepted and declined', { acceptedAt: 3, declinedAt: 3 }],
        ['accepted and revoked', { acceptedAt: 3, revokedAt: 3 }],
        ['declined and revoked', { declinedAt: 3, revokedAt: 3 }],
        ['over before it was made', { createdAt: 5, expiresAt: 5 }],
    ])('refuses an invitation %s', async (_, row) => {
        await expect(insert(row)).rejects.toThrow(/CHECK/);
    });

    it('refuses an invitation accepted by somebody but never accepted', async () => {
        await expect(insert({ acceptedBy: ana.userId })).rejects.toThrow(/CHECK/);
    });

    it('refuses an invitation for a friend or a member that does not exist', async () => {
        await expect(insert({ groupId: crypto.randomUUID() })).rejects.toThrow(/FOREIGN KEY/);
        await expect(insert({ memberId: crypto.randomUUID() })).rejects.toThrow(/FOREIGN KEY/);
    });

    it('keeps the invitations of a person who deleted their account, without them', async () => {
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');
        await insert({ acceptedBy: bruno.userId, acceptedAt: 3 });

        await env.DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(bruno.userId).run();

        const row = await env.DB.prepare('SELECT accepted_by, accepted_at FROM friend_invitations').first();
        expect(row).toEqual({ accepted_by: null, accepted_at: 3 });
    });
});
