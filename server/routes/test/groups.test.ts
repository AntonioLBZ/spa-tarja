import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_CLOSED_GROUPS, MAX_OPEN_GROUPS } from '@core/groups/shared-group';
import { app } from '@server/app';
import { put, rows, switches, trip } from '@server/testing/group-routes';
import {
    befriend,
    claim,
    groupOf,
    listGroups,
    makeGroup,
    memberNamed,
    seedClosedGroups,
    seedEntry,
    send,
} from '@server/testing/groups';
import { signIn, type TestSession } from '@server/testing/session';

let ana: TestSession;
let bruno: TestSession;
let carla: TestSession;

async function sharedWithBruno() {
    const group = await makeGroup(ana, ['Bruno']);
    await claim(memberNamed(group, 'Bruno'), bruno);
    return group;
}

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
    carla = await signIn('carla@example.com', 'Carla Ruiz');
});

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
        const friend = await befriend(ana, bruno);
        await makeGroup(bruno, [], 'Not yours');
        await makeGroup(carla, [], 'Not yours either');

        const listed = await listGroups(ana);

        expect(listed.map((group) => group.id)).toEqual([first.id, friend.id]);
        expect(listed.map((group) => group.kind)).toEqual(['group', 'direct']);
        expect(listed[0]).toEqual(first);
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

    it('answers 0 as the cursor of a group without entries', async () => {
        await makeGroup(ana);

        expect((await listGroups(ana))[0]?.seq).toBe(0);
    });

    it('answers the cursor of the last entry written', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const brunoId = memberNamed(group, 'Bruno');
        await seedEntry(group.id, { paidBy: group.me, shares: { [brunoId]: 500 } });
        await seedEntry(group.id, { paidBy: group.me, shares: { [brunoId]: 300 }, deletedAt: 2 });

        expect((await listGroups(ana))[0]?.seq).toBe(2);
    });

    it('answers a member who left no more than the cursor they left at', async () => {
        const group = await sharedWithBruno();
        const brunoId = memberNamed(group, 'Bruno');
        await seedEntry(group.id, { paidBy: group.me, shares: { [group.me]: 500 } });
        await groupOf(await send(bruno, 'DELETE', `/groups/${group.id}/members/${brunoId}`));
        await seedEntry(group.id, { paidBy: group.me, shares: { [group.me]: 700 } });

        expect((await listGroups(bruno))[0]?.seq).toBe(1);
        expect((await listGroups(ana))[0]?.seq).toBe(2);
    });
});

describe('PUT /api/groups/:id, a new group', () => {
    it('makes the group with the caller as its owner, named after their first name, and the others as dummies in the order sent', async () => {
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
            pinnedAt: null,
            seq: 0,
            members: [
                { id: body.me.id, name: 'Ana', role: 'owner', claimed: true, leftAt: null, mergedInto: null },
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

    it('is idempotent: repeating it answers the same and makes nothing more', async () => {
        const id = crypto.randomUUID();
        const body = trip();
        const first = await groupOf(await put(ana, id, body));

        const again = await groupOf(await put(ana, id, body));

        expect(again).toEqual(first);
        expect(await rows('shared_groups', id)).toBe(1);
        expect(await rows('shared_members', id)).toBe(3);
    });

    it('answers the same to the same make sent several times at once, and makes it once', async () => {
        const id = crypto.randomUUID();
        const body = trip();

        const responses = await Promise.all([put(ana, id, body), put(ana, id, body), put(ana, id, body)]);

        const groups = await Promise.all(responses.map(groupOf));
        expect(groups[1]).toEqual(groups[0]);
        expect(groups[2]).toEqual(groups[0]);
        expect(await rows('shared_groups', id)).toBe(1);
        expect(await rows('shared_members', id)).toBe(3);
    });

    it('reads an id in upper case as the same group', async () => {
        const id = crypto.randomUUID();
        const body = trip();
        const first = await groupOf(await put(ana, id, body));

        const again = await groupOf(await put(ana, id.toUpperCase(), body));
        const renamed = await groupOf(await put(ana, id.toUpperCase(), { name: 'Flat' }));

        expect(again).toEqual(first);
        expect(renamed).toEqual({ ...first, name: 'Flat' });
        expect(await listGroups(ana)).toEqual([renamed]);
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
        ['a currency that is not the app’s', trip({ currency: 'XXX' })],
        ['a currency that is another real one', trip({ currency: 'USD' })],
        [
            'a friend by name, which only an accepted invitation makes',
            {
                kind: 'direct',
                currency: 'EUR',
                me: { id: crypto.randomUUID() },
                others: [{ id: crypto.randomUUID(), name: 'Bruno' }],
            },
        ],
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

    it('makes the group in the currency of the app', async () => {
        expect((await makeGroup(ana)).currency).toBe('EUR');
    });

    it('refuses a friend by name for the id of a group that exists as well, and changes nothing', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const friend = {
            kind: 'direct',
            currency: 'EUR',
            me: { id: crypto.randomUUID() },
            others: [{ id: crypto.randomUUID(), name: 'Carla' }],
        };

        expect((await put(ana, group.id, friend)).status).toBe(400);
        expect(await listGroups(ana)).toEqual([group]);
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
        await befriend(ana, bruno);
        await makeGroup(bruno);
    });
});

describe('PUT /api/groups/:id, over the closed groups of the maker', () => {
    it(`makes a group for somebody with ${MAX_CLOSED_GROUPS - 1} closed groups, and not for one with ${MAX_CLOSED_GROUPS}`, async () => {
        await seedClosedGroups(ana.userId, MAX_CLOSED_GROUPS - 1);
        await makeGroup(ana);
        await seedClosedGroups(ana.userId, 1);
        const id = crypto.randomUUID();

        const response = await put(ana, id, trip());

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'too-many-closed-groups' });
        expect(await rows('shared_groups', id)).toBe(0);
    });

    it('counts the groups they left as well as the ones that were deleted', async () => {
        await seedClosedGroups(ana.userId, MAX_CLOSED_GROUPS / 2, 'deleted');
        await seedClosedGroups(ana.userId, MAX_CLOSED_GROUPS / 2, 'left');

        const response = await put(ana, crypto.randomUUID(), trip());

        expect(await response.json()).toEqual({ error: 'too-many-closed-groups' });
    });

    it('leaves everybody else alone, and does not count the open groups', async () => {
        await seedClosedGroups(ana.userId, MAX_CLOSED_GROUPS);
        for (let made = 0; made < 5; made++) await makeGroup(bruno);

        await makeGroup(bruno);
        await befriend(carla, bruno);

        const open = (await listGroups(bruno)).filter((group) => group.closed === null);
        expect(open.filter((group) => group.kind === 'group')).toHaveLength(6);
    });

    it('does not count a group that is somebody else’s closed group', async () => {
        await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS);

        await makeGroup(ana);
    });

    it('frees the slot of every closed group they archive, and takes it back when they bring it back', async () => {
        const piled = await seedClosedGroups(ana.userId, MAX_CLOSED_GROUPS);
        expect((await put(ana, crypto.randomUUID(), trip())).status).toBe(409);

        const archive = (id: string, archived: boolean) => switches(ana, id, { archived });
        expect((await archive(piled[0]!, true)).status).toBe(200);
        await makeGroup(ana);
        expect((await archive(piled[0]!, false)).status).toBe(200);

        const response = await put(ana, crypto.randomUUID(), trip());
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'too-many-closed-groups' });
    });

    it('does not count any archived group, and still refuses at the limit of the ones that are not', async () => {
        const piled = await seedClosedGroups(ana.userId, MAX_CLOSED_GROUPS);
        for (const id of piled) expect((await switches(ana, id, { archived: true })).status).toBe(200);
        await makeGroup(ana);
        await seedClosedGroups(ana.userId, MAX_CLOSED_GROUPS - 1);
        await makeGroup(ana);
        await seedClosedGroups(ana.userId, 1, 'left');

        const response = await put(ana, crypto.randomUUID(), trip());

        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: 'too-many-closed-groups' });
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
