import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { countClosedGroups, readGroup } from '@server/db/groups';
import { claim, makeGroup, memberNamed } from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

import type { SharedGroup } from '@core/shared-group';

let ana: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
});

function counting(db: D1Database) {
    let rows = 0;
    const statement = (inner: D1PreparedStatement): D1PreparedStatement =>
        new Proxy(inner, {
            get(target, key) {
                if (key === 'bind') return (...values: unknown[]) => statement(target.bind(...values));
                if (key === 'all' || key === 'run') {
                    return async () => {
                        const result = await target.all();
                        rows += result.meta.rows_read;
                        return result;
                    };
                }
                if (key === 'first') {
                    return async () => {
                        const result = await target.all();
                        rows += result.meta.rows_read;
                        return result.results[0] ?? null;
                    };
                }
                return Reflect.get(target, key);
            },
        });
    const counted = new Proxy(db, {
        get(target, key) {
            if (key === 'prepare') return (query: string) => statement(target.prepare(query));
            return Reflect.get(target, key);
        },
    });
    return { db: counted, rows: () => rows };
}

async function rowsToRead(group: SharedGroup) {
    const { db, rows } = counting(env.DB);
    const state = await readGroup(db, ana.userId, group.id);
    expect(state?.group.id).toBe(group.id);
    expect(state?.members.map((member) => member.id)).toEqual(group.members.map((member) => member.id));
    return rows();
}

describe('readGroup', () => {
    it('reads one group and only that one, at a cost that doesn’t grow with the groups the person is in', async () => {
        const group = await makeGroup(ana, ['Bruno', 'Carla']);
        const alone = await rowsToRead(group);

        for (let made = 0; made < 20; made++) await makeGroup(ana, ['Bruno', 'Carla']);

        expect(await rowsToRead(group)).toBeLessThan(alone * 2);
    });
});

describe('countClosedGroups', () => {
    it('keeps a closed group in the count of a member while only another member has archived it', async () => {
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');
        const trip = await makeGroup(ana, ['Bruno']);
        const brunoId = memberNamed(trip, 'Bruno');
        await claim(brunoId, bruno);
        await env.DB.prepare('UPDATE shared_groups SET deleted_at = 5, updated_at = 5 WHERE id = ?1')
            .bind(trip.id)
            .run();
        expect(await countClosedGroups(env.DB, ana.userId)).toBe(1);
        expect(await countClosedGroups(env.DB, bruno.userId)).toBe(1);

        await env.DB.prepare('UPDATE shared_members SET archived_at = 6 WHERE id = ?1').bind(brunoId).run();

        expect(await countClosedGroups(env.DB, bruno.userId)).toBe(0);
        expect(await countClosedGroups(env.DB, ana.userId)).toBe(1);
    });
});

describe('the tables of groups', () => {
    async function refused(query: string, ...values: unknown[]) {
        await expect(
            env.DB.prepare(query)
                .bind(...values)
                .run()
        ).rejects.toThrow(/constraint failed/i);
    }

    it('hold only the kinds of group and the roles there are', async () => {
        const group = await makeGroup(ana, ['Bruno']);

        await refused(`UPDATE shared_groups SET kind = 'club' WHERE id = ?1`, group.id);
        await refused(`UPDATE shared_members SET role = 'admin' WHERE id = ?1`, memberNamed(group, 'Bruno'));
    });

    it('hold one owner per group', async () => {
        const group = await makeGroup(ana, ['Bruno']);

        await refused(`UPDATE shared_members SET role = 'owner' WHERE id = ?1`, memberNamed(group, 'Bruno'));
    });

    it('hold no user in a member that was never claimed', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');

        await refused(
            `UPDATE shared_members SET user_id = ?2 WHERE id = ?1`,
            memberNamed(group, 'Bruno'),
            bruno.userId
        );
    });

    it.each([
        ['shared_groups', 'created_by'],
        ['shared_members', 'created_by'],
        ['shared_entries', 'created_by'],
        ['shared_entries', 'updated_by'],
    ])('find the rows of a user in %s.%s through an index, as deleting the account does', async (table, column) => {
        const { results } = await env.DB.prepare(`EXPLAIN QUERY PLAN SELECT 1 FROM ${table} WHERE ${column} = ?1`)
            .bind(ana.userId)
            .all<{ detail: string }>();

        expect(results.map((row) => row.detail).join(' ')).toMatch(
            new RegExp(`USING (COVERING )?INDEX \\w+ \\(${column}=\\?\\)`)
        );
    });
});
