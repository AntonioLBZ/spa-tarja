import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { readGroup } from '@server/db/groups';
import { makeGroup } from '@server/test/groups';
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
