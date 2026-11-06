import { env } from 'cloudflare:workers';
import { expect } from 'vitest';

import { app } from '@server/app';

import type { TestSession } from './session';
import type { SharedGroup } from '@core/shared-group';

// A request to the API as that person, with a JSON body when there is one
const send = async (
    as: TestSession,
    method: string,
    path: string,
    body?: unknown,
    bindings: typeof env = env
): Promise<Response> => {
    const headers = new Headers(as.headers);
    if (body !== undefined) headers.set('content-type', 'application/json');
    const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
    return app.request(`/api${path}`, init, bindings);
};

// The bindings of a request that another one overtakes: `before` runs once, just before the first write of the request
// whose SQL has `match` in it, whether it runs on its own or in a batch, which is after the request has read the group
const racingEnv = (match: string, before: () => Promise<unknown>): typeof env => {
    let landed = false;
    const marked = new WeakSet<D1PreparedStatement>();
    const land = async () => {
        if (landed) return;
        landed = true;
        await before();
    };
    const DB = new Proxy(env.DB, {
        get(target, property) {
            if (property === 'batch') {
                return async (statements: D1PreparedStatement[]) => {
                    if (statements.some((statement) => marked.has(statement))) await land();
                    return target.batch(statements);
                };
            }
            if (property === 'prepare') {
                return (sql: string) => {
                    const statement = target.prepare(sql);
                    if (!sql.includes(match)) return statement;
                    const bind = statement.bind.bind(statement);
                    statement.bind = (...values: unknown[]) => {
                        const bound = bind(...values);
                        const run = bound.run.bind(bound);
                        marked.add(bound);
                        bound.run = async () => {
                            await land();
                            return run();
                        };
                        return bound;
                    };
                    return statement;
                };
            }
            const value = Reflect.get(target, property);
            return typeof value === 'function' ? value.bind(target) : value;
        },
    });
    return new Proxy(env, { get: (target, property) => (property === 'DB' ? DB : Reflect.get(target, property)) });
};

// The group a write answers, once it answered 200
const groupOf = async (response: Response): Promise<SharedGroup> => {
    expect(response.status).toBe(200);
    return response.json();
};

const listGroups = async (as: TestSession): Promise<SharedGroup[]> => {
    const response = await send(as, 'GET', '/groups');
    expect(response.status).toBe(200);
    return ((await response.json()) as { groups: SharedGroup[] }).groups;
};

// A group made by `as` with dummies of these names
const makeGroup = async (as: TestSession, names: string[] = [], name = 'Trip'): Promise<SharedGroup> => {
    const others = names.map((other) => ({ id: crypto.randomUUID(), name: other }));
    const body = { kind: 'group', name, currency: 'EUR', me: { id: crypto.randomUUID() }, others };
    return groupOf(await send(as, 'PUT', `/groups/${crypto.randomUUID()}`, body));
};

// A friend made by `as` by name, so a dummy until somebody takes its place
const makeFriend = async (as: TestSession, name = 'Bruno'): Promise<SharedGroup> => {
    const body = {
        kind: 'direct',
        currency: 'EUR',
        me: { id: crypto.randomUUID() },
        others: [{ id: crypto.randomUUID(), name }],
    };
    return groupOf(await send(as, 'PUT', `/groups/${crypto.randomUUID()}`, body));
};

// What accepting an invitation does to the dummy of a friend: the person takes its place, under their account's name
const claim = async (memberId: string, by: TestSession): Promise<void> => {
    await env.DB.prepare(
        `UPDATE shared_members SET user_id = ?2, claimed_at = 1, name = (SELECT name FROM "user" WHERE id = ?2) WHERE id = ?1`
    )
        .bind(memberId, by.userId)
        .run();
};

// `a` and `b` made friends: a friend of `a` claimed by `b`, and the member of each in it
const befriend = async (a: TestSession, b: TestSession): Promise<{ id: string; a: string; b: string }> => {
    const friend = await makeFriend(a);
    const other = friend.members.find((member) => member.id !== friend.me);
    if (!other) throw new Error('A friend has two members');
    await claim(other.id, b);
    return { id: friend.id, a: friend.me, b: other.id };
};

// The member named so in a group
const memberNamed = (group: SharedGroup, name: string): string => {
    const member = group.members.find((candidate) => candidate.name === name);
    if (!member) throw new Error(`Nobody is named ${name}`);
    return member.id;
};

interface SeededEntry {
    paidBy: string;
    // What each member owes of it, which adds up to the amount
    shares: Record<string, number>;
    kind?: 'expense' | 'settlement';
    deletedAt?: number | null;
}

// An entry written straight into the group, with the next seq of the group, which it answers
const seedEntry = async (groupId: string, entry: SeededEntry): Promise<number> => {
    const shares = Object.entries(entry.shares).map(([memberId, cents]) => ({ memberId, cents }));
    const amount = shares.reduce((sum, share) => sum + share.cents, 0);
    const kind = entry.kind ?? 'expense';
    const row = await env.DB.prepare(
        `INSERT INTO shared_entries (id, group_id, kind, text, category_id, amount_cents, currency, date, paid_by, split,
            shares, created_at, updated_at, deleted_at, seq)
         VALUES (?1, ?2, ?3, 'Dinner', ?4, ?5, 'EUR', '2026-10-25', ?6, 'exact', ?7, 1, 1, ?8,
            (SELECT COALESCE(MAX(seq), 0) + 1 FROM shared_entries WHERE group_id = ?2))
         RETURNING seq`
    )
        .bind(
            crypto.randomUUID(),
            groupId,
            kind,
            kind === 'expense' ? 'food' : null,
            amount,
            entry.paidBy,
            JSON.stringify(shares),
            entry.deletedAt ?? null
        )
        .first<{ seq: number }>();
    if (!row) throw new Error('The entry was not written');
    return row.seq;
};

// Groups already closed for that person, written straight into the tables: deleted, or left by them. Their ids.
const seedClosedGroups = async (
    userId: string,
    count: number,
    how: 'deleted' | 'left' = 'deleted'
): Promise<string[]> => {
    const statements: D1PreparedStatement[] = [];
    const ids: string[] = [];
    for (let made = 0; made < count; made++) {
        const groupId = crypto.randomUUID();
        ids.push(groupId);
        statements.push(
            env.DB.prepare(
                `INSERT INTO shared_groups (id, kind, name, currency, created_by, created_at, updated_at, deleted_at)
                 VALUES (?1, 'group', 'Old', 'EUR', ?2, 1, 1, ?3)`
            ).bind(groupId, userId, how === 'deleted' ? 2 : null),
            env.DB.prepare(
                `INSERT INTO shared_members (id, group_id, user_id, name, role, created_at, claimed_at, left_at, left_seq)
                 VALUES (?1, ?2, ?3, 'Old', 'owner', 1, 1, ?4, ?5)`
            ).bind(crypto.randomUUID(), groupId, userId, how === 'left' ? 2 : null, how === 'left' ? 0 : null)
        );
    }
    for (let from = 0; from < statements.length; from += 50) await env.DB.batch(statements.slice(from, from + 50));
    return ids;
};

export {
    befriend,
    claim,
    groupOf,
    listGroups,
    makeFriend,
    makeGroup,
    memberNamed,
    racingEnv,
    seedClosedGroups,
    seedEntry,
    send,
};
