import { env } from 'cloudflare:workers';
import { expect } from 'vitest';

import { app } from '@server/app';

import type { TestSession } from './session';
import type { SharedGroup } from '@core/shared-group';

// A request to the API as that person, with a JSON body when there is one
const send = async (as: TestSession, method: string, path: string, body?: unknown): Promise<Response> => {
    const headers = new Headers(as.headers);
    if (body !== undefined) headers.set('content-type', 'application/json');
    const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
    return app.request(`/api${path}`, init, env);
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

export { befriend, claim, groupOf, listGroups, makeFriend, makeGroup, memberNamed, send };
