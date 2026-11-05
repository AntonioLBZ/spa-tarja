import { applyD1Migrations, type D1Migration } from 'cloudflare:test';
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
    groupId?: string | null;
    memberId?: string | null;
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
            row.groupId === undefined ? friend.id : row.groupId,
            row.memberId === undefined ? dummy : row.memberId,
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

    it('takes direct invitations, any number of them open, with no friend or dummy until one is accepted', async () => {
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');
        await insert({ groupId: null, memberId: null });
        await insert({ groupId: null, memberId: null });
        await insert({ groupId: null, memberId: null, revokedAt: 3 });

        await insert({ groupId: friend.id, memberId: null, acceptedBy: bruno.userId, acceptedAt: 3 });

        const { results } = await env.DB.prepare('SELECT id FROM friend_invitations').all();
        expect(results).toHaveLength(4);
    });

    it.each([
        ['a friend but no dummy', { memberId: null }],
        ['a dummy but no friend', { groupId: null }],
        ['no dummy and a friend before it was accepted', { memberId: null, declinedAt: 3 }],
        ['no dummy and no friend once accepted', { groupId: null, memberId: null, acceptedAt: 3 }],
    ])('refuses an invitation with %s', async (_, row) => {
        await expect(insert(row)).rejects.toThrow(/CHECK/);
    });

    it('keeps the invitations of a person who deleted their account, without them', async () => {
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');
        await insert({ acceptedBy: bruno.userId, acceptedAt: 3 });

        await env.DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(bruno.userId).run();

        const row = await env.DB.prepare('SELECT accepted_by, accepted_at FROM friend_invitations').first();
        expect(row).toEqual({ accepted_by: null, accepted_at: 3 });
    });
});

const { TEST_MIGRATIONS, MIGRATION_DB } = env as unknown as {
    TEST_MIGRATIONS: D1Migration[];
    MIGRATION_DB: D1Database;
};

describe('the migration that lets an invitation be direct', () => {
    const before = TEST_MIGRATIONS.filter((migration) => migration.name < '0013');
    const columns =
        'rowid, id, group_id, member_id, created_by, created_at, expires_at, accepted_by, accepted_at, declined_at, revoked_at';

    async function seededAt0012() {
        await applyD1Migrations(MIGRATION_DB, before);
        const at = (sql: string, ...values: unknown[]) => MIGRATION_DB.prepare(sql).bind(...values);
        await MIGRATION_DB.batch([
            at(
                `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('u1', 'Ana', 'a@x', 1, 1, 1)`
            ),
            at(
                `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ('u2', 'Bruno', 'b@x', 1, 1, 1)`
            ),
            at(
                `INSERT INTO shared_groups (id, kind, currency, created_by, created_at, updated_at) VALUES ('g1', 'direct', 'EUR', 'u1', 1, 1)`
            ),
            at(
                `INSERT INTO shared_members (id, group_id, user_id, name, role, created_at, claimed_at) VALUES ('m1', 'g1', 'u1', 'Ana', 'owner', 1, 1)`
            ),
            at(
                `INSERT INTO shared_members (id, group_id, name, role, created_at) VALUES ('m2', 'g1', 'Bruno', 'member', 2)`
            ),
            at(
                `INSERT INTO friend_invitations (rowid, id, group_id, member_id, created_by, created_at, expires_at, accepted_by, accepted_at) VALUES (10, 'i3', 'g1', 'm2', 'u1', 1, 9, 'u2', 3)`
            ),
            at(
                `INSERT INTO friend_invitations (rowid, id, group_id, member_id, created_by, created_at, expires_at, declined_at) VALUES (20, 'i1', 'g1', 'm2', 'u1', 2, 9, 4)`
            ),
            at(
                `INSERT INTO friend_invitations (rowid, id, group_id, member_id, created_by, created_at, expires_at) VALUES (30, 'i2', 'g1', 'm2', 'u1', 3, 9)`
            ),
        ]);
    }

    function stored() {
        return MIGRATION_DB.prepare(`SELECT ${columns} FROM friend_invitations ORDER BY rowid`).all();
    }

    it('keeps every row in the order they were made, every index and the rules of the table', async () => {
        await seededAt0012();
        const rows = (await stored()).results;
        const indexes = async () => {
            const { results } = await MIGRATION_DB.prepare(
                `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'friend_invitations' AND sql IS NOT NULL ORDER BY name`
            ).all();
            return results;
        };
        const indexesBefore = await indexes();

        await applyD1Migrations(MIGRATION_DB, TEST_MIGRATIONS);

        expect((await stored()).results).toEqual(rows);
        expect(rows.map((row) => [row.rowid, row.id])).toEqual([
            [10, 'i3'],
            [20, 'i1'],
            [30, 'i2'],
        ]);
        expect(await indexes()).toEqual(indexesBefore);
        expect(indexesBefore).toHaveLength(4);
        const insert = (values: string) =>
            MIGRATION_DB.prepare(
                `INSERT INTO friend_invitations (id, group_id, member_id, created_by, created_at, expires_at, revoked_at) VALUES ${values}`
            ).run();
        await expect(insert(`('i4', 'g1', 'm2', 'u1', 5, 9, NULL)`)).rejects.toThrow(/UNIQUE/);
        await expect(insert(`('i4', 'g1', 'm2', 'u1', 5, 5, 6)`)).rejects.toThrow(/CHECK/);
        await expect(insert(`('i4', 'nope', 'm2', 'u1', 5, 9, 6)`)).rejects.toThrow(/FOREIGN KEY/);
        await insert(`('i4', NULL, NULL, 'u1', 5, 9, NULL)`);
        await MIGRATION_DB.prepare(`DELETE FROM "user" WHERE id = 'u1'`).run();
        const left = await MIGRATION_DB.prepare(
            'SELECT COUNT(*) AS n FROM friend_invitations WHERE created_by IS NULL'
        ).first();
        expect(left).toEqual({ n: 4 });
    });
});
