import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_FRIENDS, MAX_OPEN_GROUPS } from '@core/shared-group';
import { app } from '@server/app';
import {
    befriend,
    claim,
    groupOf,
    listGroups,
    makeFriend,
    makeGroup,
    memberNamed,
    seedEntry,
    send,
} from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

let ana: TestSession;
let bruno: TestSession;
let carla: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
    carla = await signIn('carla@example.com', 'Carla Ruiz');
});

function trip(overrides: Record<string, unknown> = {}) {
    return {
        kind: 'group',
        name: 'Trip to Lisbon',
        currency: 'EUR',
        me: { id: crypto.randomUUID() },
        others: [
            { id: crypto.randomUUID(), name: 'Bruno' },
            { id: crypto.randomUUID(), name: 'Carla' },
        ],
        ...overrides,
    };
}

function put(as: TestSession, id: string, body: unknown) {
    return send(as, 'PUT', `/groups/${id}`, body);
}

function handOver(as: TestSession, id: string, memberId: string) {
    return send(as, 'POST', `/groups/${id}/owner`, { memberId });
}

function switches(as: TestSession, id: string, body: unknown) {
    return send(as, 'PUT', `/groups/${id}/me`, body);
}

function remove(as: TestSession, id: string) {
    return send(as, 'DELETE', `/groups/${id}`);
}

async function rows(table: string, groupId: string) {
    const column = table === 'shared_groups' ? 'id' : 'group_id';
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?1`).bind(groupId).first();
    return row?.n;
}

// A group of Ana's in which Bruno is a member who is a user
async function sharedWithBruno() {
    const group = await makeGroup(ana, ['Bruno']);
    await claim(memberNamed(group, 'Bruno'), bruno);
    return group;
}

describe('without a session', () => {
    it('answers 401 to a read and to a write', async () => {
        expect((await app.request('/api/groups', {}, env)).status).toBe(401);
        const write = await app.request(
            `/api/groups/${crypto.randomUUID()}`,
            { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(trip()) },
            env
        );
        expect(write.status).toBe(401);
    });
});

describe('GET /api/groups', () => {
    it('starts empty', async () => {
        expect(await listGroups(ana)).toEqual([]);
    });

    it('lists the groups and the friends the caller is in, oldest first, and nobody else’s', async () => {
        const first = await makeGroup(ana);
        const friend = await makeFriend(ana);
        await makeGroup(bruno, [], 'Not yours');

        expect(await listGroups(ana)).toEqual([first, friend]);
    });

    it('never tells a user id or an email', async () => {
        await sharedWithBruno();
        await befriend(ana, bruno);

        const response = await send(ana, 'GET', '/groups');
        const text = await response.text();

        for (const secret of [ana.userId, bruno.userId, 'ana@example.com', 'bruno@example.com']) {
            expect(text).not.toContain(secret);
        }
        const { groups } = JSON.parse(text) as { groups: Array<{ members: object[] }> };
        for (const member of groups.flatMap((group) => group.members)) {
            expect(Object.keys(member).sort()).toEqual(['claimed', 'id', 'leftAt', 'mergedInto', 'name', 'role']);
        }
    });
});

describe('PUT /api/groups/:id, a new group', () => {
    it('makes the group with the caller as its owner, named after their account, and the others as dummies in the order sent', async () => {
        const id = crypto.randomUUID();
        const body = trip();

        const group = await groupOf(await put(ana, id, body));

        expect(group).toEqual({
            id,
            kind: 'group',
            name: 'Trip to Lisbon',
            currency: 'EUR',
            simplifyDebts: false,
            closed: null,
            archived: false,
            me: body.me.id,
            showInExpenses: true,
            members: [
                { id: body.me.id, name: 'Ana García', role: 'owner', claimed: true, leftAt: null, mergedInto: null },
                ...body.others.map((other) => ({
                    id: other.id,
                    name: other.name,
                    role: 'member',
                    claimed: false,
                    leftAt: null,
                    mergedInto: null,
                })),
            ],
        });
        expect(await listGroups(ana)).toEqual([group]);
    });

    it('names the maker after their nickname, as it was when the group was made', async () => {
        await send(ana, 'PUT', '/profile', { nickname: 'Anita' });
        const group = await makeGroup(ana);

        await send(ana, 'PUT', '/profile', { nickname: 'La Ana' });

        const [listed] = await listGroups(ana);
        expect(listed?.members).toEqual([expect.objectContaining({ id: group.me, name: 'Anita' })]);
    });

    it('makes a friend: no name, the maker and one dummy', async () => {
        const id = crypto.randomUUID();
        const me = crypto.randomUUID();
        const other = crypto.randomUUID();

        const friend = await groupOf(
            await put(ana, id, {
                kind: 'direct',
                currency: 'EUR',
                me: { id: me },
                others: [{ id: other, name: 'Bruno' }],
            })
        );

        expect(friend).toMatchObject({ id, kind: 'direct', name: null, me });
        expect(friend.members).toEqual([
            { id: me, name: 'Ana García', role: 'owner', claimed: true, leftAt: null, mergedInto: null },
            { id: other, name: 'Bruno', role: 'member', claimed: false, leftAt: null, mergedInto: null },
        ]);
    });

    it('is idempotent: repeating it answers the same and makes nothing more', async () => {
        const id = crypto.randomUUID();
        const body = trip();
        const first = await groupOf(await put(ana, id, body));

        const again = await groupOf(await put(ana, id, body));

        expect(again).toEqual(first);
        expect(await rows('shared_groups', id)).toBe(1);
        expect(await rows('shared_members', id)).toBe(3);
    });

    it('answers 409 id-taken for the id of a group of somebody else, and leaves it as it was', async () => {
        const theirs = await makeGroup(bruno, ['Carla'], 'Flat');

        const response = await put(ana, theirs.id, trip());

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'id-taken' });
        expect(await listGroups(bruno)).toEqual([theirs]);
        expect(await listGroups(ana)).toEqual([]);
    });

    it('answers 409 id-taken for a member id that is in another group, and makes nothing', async () => {
        const theirs = await makeGroup(bruno, ['Carla']);
        const id = crypto.randomUUID();

        const response = await put(ana, id, trip({ others: [{ id: memberNamed(theirs, 'Carla'), name: 'Carla' }] }));

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'id-taken' });
        expect(await rows('shared_groups', id)).toBe(0);
        expect(await listGroups(bruno)).toEqual([theirs]);
    });

    it.each([
        ['a group without a name', trip({ name: undefined })],
        ['a name too long', trip({ name: 'x'.repeat(41) })],
        [
            'a friend with a name',
            {
                kind: 'direct',
                name: 'Bruno',
                currency: 'EUR',
                me: { id: crypto.randomUUID() },
                others: [{ id: crypto.randomUUID(), name: 'Bruno' }],
            },
        ],
        [
            'a member twice',
            trip({ others: [{ id: crypto.randomUUID(), name: 'Bruno' }].flatMap((other) => [other, other]) }),
        ],
        ['a body that is not a group', 'Trip'],
    ])('refuses %s with 400 and makes nothing', async (_, body) => {
        const id = crypto.randomUUID();

        const response = await put(ana, id, body);

        expect(response.status).toBe(400);
        expect(await rows('shared_groups', id)).toBe(0);
    });

    it('refuses an id that is not a UUID with 400', async () => {
        expect((await put(ana, 'trip', trip())).status).toBe(400);
    });

    it(`makes at most ${MAX_OPEN_GROUPS} open groups per person, friends apart`, async () => {
        for (let made = 0; made < MAX_OPEN_GROUPS; made++) await makeGroup(ana);
        const id = crypto.randomUUID();

        const response = await put(ana, id, trip());

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'too-many-groups' });
        expect(await rows('shared_groups', id)).toBe(0);
        await makeFriend(ana);
        await makeGroup(bruno);
    });

    it(`makes at most ${MAX_FRIENDS} friends per person, groups apart`, async () => {
        for (let made = 0; made < MAX_FRIENDS; made++) await makeFriend(ana);

        const response = await put(ana, crypto.randomUUID(), {
            kind: 'direct',
            currency: 'EUR',
            me: { id: crypto.randomUUID() },
            others: [{ id: crypto.randomUUID(), name: 'One more' }],
        });

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'too-many-friends' });
        await makeGroup(ana);
        await makeFriend(bruno);
    });
});

describe('PUT /api/groups/:id, a change', () => {
    it('lets the owner rename the group and switch the simplified debts', async () => {
        const group = await makeGroup(ana);

        const renamed = await groupOf(await put(ana, group.id, { name: ' Flat ' }));
        const simplified = await groupOf(await put(ana, group.id, { simplifyDebts: true }));

        expect(renamed).toEqual({ ...group, name: 'Flat' });
        expect(simplified).toEqual({ ...group, name: 'Flat', simplifyDebts: true });
        expect(await listGroups(ana)).toEqual([simplified]);
    });

    it('reads a new group sent again as a change of its name', async () => {
        const id = crypto.randomUUID();
        const body = trip();
        await put(ana, id, body);

        const again = await groupOf(await put(ana, id, { ...body, name: 'Flat' }));

        expect(again.name).toBe('Flat');
        expect(again.members).toHaveLength(3);
    });

    it('refuses a change to a member who is not the owner, with 403, and changes nothing', async () => {
        const group = await sharedWithBruno();

        const rename = await put(bruno, group.id, { name: 'Mine now' });
        const simplify = await put(bruno, group.id, { simplifyDebts: true });

        expect(rename.status).toBe(403);
        expect(await rename.json()).toEqual({ error: 'not-owner' });
        expect(simplify.status).toBe(403);
        expect((await listGroups(ana))[0]).toMatchObject({ name: 'Trip', simplifyDebts: false });
    });

    it('answers a member who sends what is there already, as nothing changes', async () => {
        const group = await sharedWithBruno();

        const same = await put(bruno, group.id, { name: 'Trip', simplifyDebts: false });

        expect(same.status).toBe(200);
    });

    it('lets either side of a friend switch the simplified debts, and keeps the friend without a name', async () => {
        const friend = await befriend(ana, bruno);

        const switched = await groupOf(await put(bruno, friend.id, { simplifyDebts: true, name: 'Ana' }));
        const back = await groupOf(await put(ana, friend.id, { simplifyDebts: false }));

        expect(switched).toMatchObject({ simplifyDebts: true, name: null });
        expect(back).toMatchObject({ simplifyDebts: false, name: null });
    });

    it('answers 404 to a change of a group that does not exist', async () => {
        const response = await put(ana, crypto.randomUUID(), { name: 'Flat' });

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'not-found' });
    });
});

describe('DELETE /api/groups/:id', () => {
    it('lets the owner delete a settled group: it closes for everybody and keeps its rows', async () => {
        const group = await sharedWithBruno();
        const brunoId = memberNamed(group, 'Bruno');
        await seedEntry(group.id, { paidBy: group.me, shares: { [brunoId]: 700 } });
        await seedEntry(group.id, { paidBy: brunoId, shares: { [group.me]: 700 }, kind: 'settlement' });

        const deleted = await groupOf(await remove(ana, group.id));

        expect(deleted).toEqual({ ...group, members: deleted.members, closed: 'deleted' });
        expect((await listGroups(bruno))[0]).toMatchObject({ id: group.id, closed: 'deleted' });
        expect(await rows('shared_groups', group.id)).toBe(1);
        expect(await rows('shared_members', group.id)).toBe(2);
        expect(await rows('shared_entries', group.id)).toBe(2);
    });

    it('refuses to delete a group while a balance isn’t zero and another user is in it', async () => {
        const group = await sharedWithBruno();
        await seedEntry(group.id, { paidBy: group.me, shares: { [memberNamed(group, 'Bruno')]: 700 } });

        const response = await remove(ana, group.id);

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'unsettled' });
        expect((await listGroups(ana))[0]?.closed).toBeNull();
    });

    it('deletes a group of the owner and dummies whatever the balances', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        await seedEntry(group.id, { paidBy: group.me, shares: { [memberNamed(group, 'Bruno')]: 700 } });

        expect((await groupOf(await remove(ana, group.id))).closed).toBe('deleted');
    });

    it('deletes a group whatever the balances once the other users have left it', async () => {
        const group = await sharedWithBruno();
        const brunoId = memberNamed(group, 'Bruno');
        await groupOf(await send(bruno, 'DELETE', `/groups/${group.id}/members/${brunoId}`));
        await seedEntry(group.id, { paidBy: group.me, shares: { [brunoId]: 700 } });

        expect((await groupOf(await remove(ana, group.id))).closed).toBe('deleted');
    });

    it('lets nobody but the owner delete a group', async () => {
        const group = await sharedWithBruno();

        const response = await remove(bruno, group.id);

        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: 'not-owner' });
        expect((await listGroups(ana))[0]?.closed).toBeNull();
    });

    it('lets either side delete a friend: a dummy one at any time, a real one once settled', async () => {
        const dummy = await makeFriend(ana);
        await seedEntry(dummy.id, { paidBy: dummy.me, shares: { [dummy.members[1]?.id ?? '']: 900 } });
        const real = await befriend(ana, bruno);
        await seedEntry(real.id, { paidBy: real.a, shares: { [real.b]: 900 } });

        const refused = await remove(bruno, real.id);
        await seedEntry(real.id, { paidBy: real.b, shares: { [real.a]: 900 }, kind: 'settlement' });

        expect((await groupOf(await remove(ana, dummy.id))).closed).toBe('deleted');
        expect(refused.status).toBe(409);
        expect((await groupOf(await remove(bruno, real.id))).closed).toBe('deleted');
    });

    it('answers the group when it is sent again', async () => {
        const group = await makeGroup(ana);
        const first = await groupOf(await remove(ana, group.id));

        expect(await groupOf(await remove(ana, group.id))).toEqual(first);
    });
});

describe('POST /api/groups/:id/owner', () => {
    it('hands the group over to a member who is a user, who then does what the owner does', async () => {
        const group = await sharedWithBruno();
        const brunoId = memberNamed(group, 'Bruno');

        const after = await groupOf(await handOver(ana, group.id, brunoId));

        expect(after.members.map((member) => member.role)).toEqual(['member', 'owner']);
        expect((await groupOf(await put(bruno, group.id, { name: 'Flat' }))).name).toBe('Flat');
        expect(await (await put(ana, group.id, { name: 'Trip' })).json()).toEqual({ error: 'not-owner' });
        expect((await groupOf(await send(ana, 'DELETE', `/groups/${group.id}/members/${group.me}`))).closed).toBe(
            'left'
        );
    });

    it('answers the group when it is sent again', async () => {
        const group = await sharedWithBruno();
        const first = await groupOf(await handOver(ana, group.id, memberNamed(group, 'Bruno')));

        expect(await groupOf(await handOver(bruno, group.id, memberNamed(group, 'Bruno')))).toEqual({
            ...first,
            me: memberNamed(group, 'Bruno'),
        });
    });

    it('hands it over to nobody but a member who is a user and hasn’t left', async () => {
        const group = await makeGroup(ana, ['Bruno', 'Carla']);
        await claim(memberNamed(group, 'Bruno'), bruno);
        await groupOf(await send(bruno, 'DELETE', `/groups/${group.id}/members/${memberNamed(group, 'Bruno')}`));

        const toDummy = await handOver(ana, group.id, memberNamed(group, 'Carla'));
        const toLeft = await handOver(ana, group.id, memberNamed(group, 'Bruno'));
        const toNobody = await handOver(ana, group.id, crypto.randomUUID());

        expect([toDummy.status, await toDummy.json()]).toEqual([409, { error: 'not-a-user' }]);
        expect([toLeft.status, await toLeft.json()]).toEqual([422, { error: 'member-left' }]);
        expect([toNobody.status, await toNobody.json()]).toEqual([422, { error: 'unknown-member' }]);
        expect((await listGroups(ana))[0]?.members[0]?.role).toBe('owner');
    });

    it('lets nobody but the owner hand the group over', async () => {
        const group = await sharedWithBruno();

        const response = await handOver(bruno, group.id, memberNamed(group, 'Bruno'));

        expect([response.status, await response.json()]).toEqual([403, { error: 'not-owner' }]);
    });

    it('has nothing to hand over in a friend', async () => {
        const friend = await befriend(ana, bruno);

        const response = await handOver(ana, friend.id, friend.b);

        expect([response.status, await response.json()]).toEqual([409, { error: 'direct' }]);
    });
});

describe('PUT /api/groups/:id/me', () => {
    it('switches whether the group is in the caller’s expenses, and nobody else’s', async () => {
        const group = await sharedWithBruno();

        const off = await groupOf(await switches(ana, group.id, { showInExpenses: false }));

        expect(off).toEqual({ ...group, showInExpenses: false, members: off.members });
        expect((await listGroups(bruno))[0]?.showInExpenses).toBe(true);
        expect((await groupOf(await switches(ana, group.id, { showInExpenses: true }))).showInExpenses).toBe(true);
    });

    it('archives only a closed group, and brings it back', async () => {
        const group = await makeGroup(ana);

        const open = await switches(ana, group.id, { archived: true });
        const notArchived = await groupOf(await switches(ana, group.id, { archived: false }));
        await groupOf(await remove(ana, group.id));
        const archived = await groupOf(await switches(ana, group.id, { archived: true }));
        const back = await groupOf(await switches(ana, group.id, { archived: false }));

        expect([open.status, await open.json()]).toEqual([409, { error: 'not-closed' }]);
        expect(notArchived.archived).toBe(false);
        expect(archived).toMatchObject({ closed: 'deleted', archived: true });
        expect(back).toMatchObject({ closed: 'deleted', archived: false });
    });

    it('lets a member who left archive the group and take it out of their expenses', async () => {
        const group = await sharedWithBruno();
        await groupOf(await send(bruno, 'DELETE', `/groups/${group.id}/members/${memberNamed(group, 'Bruno')}`));

        const after = await groupOf(await switches(bruno, group.id, { archived: true, showInExpenses: false }));

        expect(after).toMatchObject({ closed: 'left', archived: true, showInExpenses: false });
        expect((await listGroups(ana))[0]).toMatchObject({ archived: false, showInExpenses: true });
    });
});

describe('a closed group', () => {
    it('takes no write once it is deleted', async () => {
        const group = await sharedWithBruno();
        const carlaId = crypto.randomUUID();
        await groupOf(await send(ana, 'PUT', `/groups/${group.id}/members/${carlaId}`, { name: 'Carla' }));
        await groupOf(await remove(ana, group.id));
        const friend = await befriend(ana, carla);

        const writes = [
            put(ana, group.id, { name: 'Flat' }),
            put(ana, group.id, { simplifyDebts: true }),
            send(ana, 'PUT', `/groups/${group.id}/members/${crypto.randomUUID()}`, { name: 'Dani' }),
            send(ana, 'PUT', `/groups/${group.id}/members/${carlaId}`, { name: 'Carla R.' }),
            send(ana, 'PUT', `/groups/${group.id}/members/${crypto.randomUUID()}`, { friend: friend.id }),
            send(ana, 'DELETE', `/groups/${group.id}/members/${carlaId}`),
            send(bruno, 'DELETE', `/groups/${group.id}/members/${memberNamed(group, 'Bruno')}`),
            send(ana, 'POST', `/groups/${group.id}/members/${carlaId}/merge`, { into: memberNamed(group, 'Bruno') }),
            handOver(ana, group.id, memberNamed(group, 'Bruno')),
        ];

        for (const response of await Promise.all(writes)) {
            expect(response.status).toBe(409);
            expect(await response.json()).toEqual({ error: 'closed' });
        }
        expect((await listGroups(ana))[0]).toMatchObject({ name: 'Trip', simplifyDebts: false, closed: 'deleted' });
    });

    it('takes no write from a member who left it', async () => {
        const group = await sharedWithBruno();
        await groupOf(await send(bruno, 'DELETE', `/groups/${group.id}/members/${memberNamed(group, 'Bruno')}`));

        for (const response of [await put(bruno, group.id, { name: 'Flat' }), await remove(bruno, group.id)]) {
            expect(response.status).toBe(409);
            expect(await response.json()).toEqual({ error: 'closed' });
        }
        expect((await listGroups(ana))[0]).toMatchObject({ name: 'Trip', closed: null });
    });

    it(`doesn’t count toward the ${MAX_OPEN_GROUPS} open groups, deleted or left`, async () => {
        const groups = [];
        for (let made = 0; made < MAX_OPEN_GROUPS; made++) groups.push(await makeGroup(ana));
        await groupOf(await remove(ana, groups[0]?.id ?? ''));
        const shared = await makeGroup(bruno, ['Ana']);
        await claim(memberNamed(shared, 'Ana'), ana);
        await groupOf(await send(ana, 'DELETE', `/groups/${shared.id}/members/${memberNamed(shared, 'Ana')}`));

        expect((await put(ana, crypto.randomUUID(), trip())).status).toBe(200);
        expect((await put(ana, crypto.randomUUID(), trip())).status).toBe(409);
    });
});

describe('a stranger', () => {
    it('gets the same 404 for a group of somebody else as for one that does not exist, and changes nothing', async () => {
        const group = await makeGroup(ana, ['Bruno']);

        const theirs = await put(carla, group.id, { name: 'Mine now', simplifyDebts: true });
        const missing = await put(carla, crypto.randomUUID(), { name: 'Mine now', simplifyDebts: true });

        expect(theirs.status).toBe(404);
        expect(missing.status).toBe(404);
        expect(await theirs.text()).toBe(await missing.text());
        for (const write of [
            (id: string) => handOver(carla, id, memberNamed(group, 'Bruno')),
            (id: string) => switches(carla, id, { showInExpenses: false }),
        ]) {
            const response = await write(group.id);
            expect(response.status).toBe(404);
            expect(await response.text()).toBe(await (await write(crypto.randomUUID())).text());
        }
        const deleted = await remove(carla, group.id);
        expect(deleted.status).toBe(404);
        expect(await deleted.text()).toBe(await (await remove(carla, crypto.randomUUID())).text());
        expect(await listGroups(ana)).toEqual([group]);
    });

    it('does not see the group in their list', async () => {
        await makeGroup(ana, ['Bruno']);
        await befriend(ana, bruno);

        expect(await listGroups(carla)).toEqual([]);
    });
});

describe('the names of people', () => {
    it('shows the other side of a friend by their nickname, live, and keeps the name a group gave them', async () => {
        const friend = await befriend(ana, bruno);
        const group = await sharedWithBruno();

        await send(bruno, 'PUT', '/profile', { nickname: 'Bruni' });

        const groups = await listGroups(ana);
        const nameIn = (id: string, member: string) =>
            groups.find((candidate) => candidate.id === id)?.members.find((candidate) => candidate.id === member)?.name;
        expect(nameIn(friend.id, friend.b)).toBe('Bruni');
        expect(nameIn(group.id, memberNamed(group, 'Bruno'))).toBe('Bruno Díaz');

        await send(bruno, 'PUT', '/profile', { nickname: null });

        expect((await listGroups(ana)).find((candidate) => candidate.id === friend.id)?.members[1]?.name).toBe(
            'Bruno Díaz'
        );
    });
});
