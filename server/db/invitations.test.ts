import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { acceptInvitation } from '@server/db/invitations';
import { makeGroup } from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

import type { SharedGroup } from '@core/shared-group';

let ana: TestSession;
let shared: SharedGroup;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    shared = await makeGroup(ana, ['Bruno']);
});

interface Row {
    id?: string;
    groupId?: string | null;
    createdAt?: number;
    expiresAt?: number;
    acceptedBy?: string | null;
    acceptedAt?: number | null;
    declinedAt?: number | null;
    revokedAt?: number | null;
}

function insert(row: Row = {}) {
    return env.DB.prepare(
        `INSERT INTO friend_invitations (id, group_id, created_by, created_at, expires_at, accepted_by, accepted_at,
            declined_at, revoked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
        .bind(
            row.id ?? crypto.randomUUID(),
            row.groupId ?? null,
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
    it('holds any number of open invitations of one person, with no friend until one is accepted', async () => {
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');
        await insert();
        await insert();
        await insert({ revokedAt: 3 });

        await insert({ groupId: shared.id, acceptedBy: bruno.userId, acceptedAt: 3 });

        const { results } = await env.DB.prepare('SELECT id FROM friend_invitations').all();
        expect(results).toHaveLength(4);
    });

    it.each<[string, () => Row]>([
        ['accepted and declined', () => ({ groupId: shared.id, acceptedAt: 3, declinedAt: 3 })],
        ['accepted and revoked', () => ({ groupId: shared.id, acceptedAt: 3, revokedAt: 3 })],
        ['declined and revoked', () => ({ declinedAt: 3, revokedAt: 3 })],
        ['over before it was made', () => ({ createdAt: 5, expiresAt: 5 })],
    ])('refuses an invitation %s', async (_, row) => {
        await expect(insert(row())).rejects.toThrow(/CHECK/);
    });

    it('refuses an invitation accepted by somebody but never accepted', async () => {
        await expect(insert({ acceptedBy: ana.userId })).rejects.toThrow(/CHECK/);
    });

    it('refuses an invitation for a friend that does not exist', async () => {
        await expect(insert({ groupId: crypto.randomUUID(), acceptedAt: 3 })).rejects.toThrow(/FOREIGN KEY/);
    });

    it.each<[string, () => Row]>([
        ['a friend before it was accepted', () => ({ groupId: shared.id, declinedAt: 3 })],
        ['no friend once accepted', () => ({ acceptedAt: 3 })],
    ])('refuses an invitation with %s', async (_, row) => {
        await expect(insert(row())).rejects.toThrow(/CHECK/);
    });

    it('keeps the invitations of a person who deleted their account, without them', async () => {
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');
        await insert({ groupId: shared.id, acceptedBy: bruno.userId, acceptedAt: 3 });

        await env.DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(bruno.userId).run();

        const row = await env.DB.prepare('SELECT accepted_by, accepted_at FROM friend_invitations').first();
        expect(row).toEqual({ accepted_by: null, accepted_at: 3 });
    });
});

describe('taking an invitation', () => {
    it('writes nothing when the invitation can no longer be taken', async () => {
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');
        const id = crypto.randomUUID();
        await insert({ id, expiresAt: Date.now() + 60_000, revokedAt: 1 });
        const count = async () =>
            await env.DB.prepare(
                'SELECT (SELECT COUNT(*) FROM shared_groups) AS groups, (SELECT COUNT(*) FROM shared_members) AS members'
            ).first();
        const before = await count();

        const friendId = await acceptInvitation(env.DB, id, { userId: bruno.userId, name: 'Bruno' }, 'Ana');

        expect(friendId).toBeNull();
        expect(await count()).toEqual(before);
    });
});
