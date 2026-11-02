import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_GROUP_MEMBERS, MAX_OPEN_GROUPS } from '@core/shared-group';
import {
    befriend,
    groupOf,
    listGroups,
    makeFriend,
    makeGroup,
    memberNamed,
    seedEntry,
    send,
} from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

import type { SharedGroup } from '@core/shared-group';

let ana: TestSession;
let bruno: TestSession;
let carla: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
    carla = await signIn('carla@example.com', 'Carla Ruiz');
});

function putMember(as: TestSession, groupId: string, memberId: string, body: unknown) {
    return send(as, 'PUT', `/groups/${groupId}/members/${memberId}`, body);
}

async function addDummy(as: TestSession, groupId: string, name: string) {
    const id = crypto.randomUUID();
    return { id, group: await groupOf(await putMember(as, groupId, id, { name })) };
}

async function addFriend(as: TestSession, groupId: string, friend: string, replaces?: string) {
    const id = crypto.randomUUID();
    return { id, group: await groupOf(await putMember(as, groupId, id, { friend, replaces })) };
}

// Ana's group with Bruno in it, added from her friends
async function tripWithBruno(dummies: string[] = []) {
    const group = await makeGroup(ana, dummies);
    const friend = await befriend(ana, bruno);
    const { id, group: joined } = await addFriend(ana, group.id, friend.id);
    return { group: joined, bruno: id };
}

function member(group: SharedGroup, id: string) {
    return group.members.find((candidate) => candidate.id === id);
}

function removeMember(as: TestSession, groupId: string, memberId: string) {
    return send(as, 'DELETE', `/groups/${groupId}/members/${memberId}`);
}

function merge(as: TestSession, groupId: string, memberId: string, into: string) {
    return send(as, 'POST', `/groups/${groupId}/members/${memberId}/merge`, { into });
}

async function groupOfAna(groupId: string) {
    const group = (await listGroups(ana)).find((candidate) => candidate.id === groupId);
    if (!group) throw new Error('Ana is not in the group');
    return group;
}

async function error(response: Response, status: number) {
    expect(response.status).toBe(status);
    return ((await response.json()) as { error: string }).error;
}

describe('PUT /api/groups/:groupId/members/:memberId, a dummy', () => {
    it('lets any member add a dummy by name, at the end of the group', async () => {
        const { group } = await tripWithBruno();

        const { id, group: after } = await addDummy(bruno, group.id, ' Dani ');

        expect(after.members.at(-1)).toEqual({
            id,
            name: 'Dani',
            role: 'member',
            claimed: false,
            leftAt: null,
            mergedInto: null,
        });
        expect((await listGroups(ana)).find((candidate) => candidate.id === group.id)?.members).toEqual(after.members);
    });

    it('is idempotent: repeating it answers the same and adds nobody', async () => {
        const group = await makeGroup(ana);
        const id = crypto.randomUUID();
        const first = await groupOf(await putMember(ana, group.id, id, { name: 'Dani' }));

        const again = await groupOf(await putMember(ana, group.id, id, { name: 'Dani' }));

        expect(again).toEqual(first);
        expect(again.members).toHaveLength(2);
    });

    it(`adds nobody past ${MAX_GROUP_MEMBERS} members`, async () => {
        const full = await makeGroup(
            ana,
            Array.from({ length: MAX_GROUP_MEMBERS - 1 }, (_, index) => `Dummy ${index}`)
        );

        expect(await error(await putMember(ana, full.id, crypto.randomUUID(), { name: 'One more' }), 409)).toBe(
            'too-many-members'
        );
        expect((await listGroups(ana))[0]?.members).toHaveLength(MAX_GROUP_MEMBERS);
    });

    it('answers 409 id-taken for the id of a member of another group, and changes neither', async () => {
        const theirs = await makeGroup(bruno, ['Carla']);
        const group = await makeGroup(ana);

        const response = await putMember(ana, group.id, memberNamed(theirs, 'Carla'), { name: 'Carla' });

        expect(await error(response, 409)).toBe('id-taken');
        expect(await listGroups(ana)).toEqual([group]);
        expect(await listGroups(bruno)).toEqual([theirs]);
    });

    it('refuses a third member in a friend', async () => {
        const friend = await makeFriend(ana);

        expect(await error(await putMember(ana, friend.id, crypto.randomUUID(), { name: 'Dani' }), 409)).toBe('direct');
        expect((await listGroups(ana))[0]?.members).toHaveLength(2);
    });

    it.each([
        ['an empty name', { name: ' ' }],
        ['a name too long', { name: 'x'.repeat(41) }],
        ['nothing', {}],
    ])('refuses %s with 400', async (_, body) => {
        const group = await makeGroup(ana);

        expect((await putMember(ana, group.id, crypto.randomUUID(), body)).status).toBe(400);
    });

    it('refuses a member id that is not a UUID with 400', async () => {
        const group = await makeGroup(ana);

        expect((await putMember(ana, group.id, 'dani', { name: 'Dani' })).status).toBe(400);
    });
});

describe('PUT /api/groups/:groupId/members/:memberId, a new name', () => {
    it('lets the owner rename anybody', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Carla']);

        await groupOf(await putMember(ana, group.id, memberNamed(group, 'Carla'), { name: 'Carla R.' }));
        const after = await groupOf(await putMember(ana, group.id, brunoId, { name: 'Bru' }));

        expect(member(after, memberNamed(group, 'Carla'))?.name).toBe('Carla R.');
        expect(member(after, brunoId)?.name).toBe('Bru');
    });

    it('lets a user rename themselves, and nobody else', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Carla']);

        const renamed = await groupOf(await putMember(bruno, group.id, brunoId, { name: 'Bru' }));
        const other = await putMember(bruno, group.id, memberNamed(group, 'Carla'), { name: 'Mallory' });
        const owner = await putMember(bruno, group.id, group.me, { name: 'Mallory' });

        expect(member(renamed, brunoId)?.name).toBe('Bru');
        expect(await error(other, 403)).toBe('not-owner');
        expect(await error(owner, 403)).toBe('not-owner');
        const [after] = await listGroups(ana);
        expect(after?.members.map((candidate) => candidate.name)).toEqual(['Ana García', 'Carla', 'Bru']);
    });

    it('lets either side of a friend rename the other', async () => {
        const friend = await befriend(ana, bruno);

        const byAna = await groupOf(await putMember(ana, friend.id, friend.b, { name: 'Bru' }));
        const byBruno = await groupOf(await putMember(bruno, friend.id, friend.a, { name: 'Anita' }));

        expect(member(byAna, friend.b)?.name).toBe('Bru');
        expect(member(byBruno, friend.a)?.name).toBe('Anita');
    });
});

describe('PUT /api/groups/:groupId/members/:memberId, a friend', () => {
    it('adds a real friend at once, named after their account, and the group is theirs to see', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);

        const { id, group: after } = await addFriend(ana, group.id, friend.id);

        expect(member(after, id)).toEqual({
            id,
            name: 'Bruno Díaz',
            role: 'member',
            claimed: true,
            leftAt: null,
            mergedInto: null,
        });
        const theirs = (await listGroups(bruno)).find((candidate) => candidate.id === group.id);
        expect(theirs).toEqual({ ...after, me: id });
    });

    it('names the friend after their nickname, as it is when they are added', async () => {
        await send(bruno, 'PUT', '/profile', { nickname: 'Bruni' });
        const { group, bruno: brunoId } = await tripWithBruno();

        await send(bruno, 'PUT', '/profile', { nickname: 'El Bruno' });

        expect(member((await listGroups(ana))[0] ?? group, brunoId)?.name).toBe('Bruni');
    });

    it('lets any member add their own friends', async () => {
        const { group } = await tripWithBruno();
        const friend = await befriend(bruno, carla);

        const { id, group: after } = await addFriend(bruno, group.id, friend.id);

        expect(member(after, id)?.name).toBe('Carla Ruiz');
    });

    it('is idempotent: repeating it answers the same and adds nobody', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);
        const id = crypto.randomUUID();
        const first = await groupOf(await putMember(ana, group.id, id, { friend: friend.id }));

        const again = await groupOf(await putMember(ana, group.id, id, { friend: friend.id }));

        expect(again).toEqual(first);
        expect(again.members).toHaveLength(2);
    });

    it('refuses a friend that is not the caller’s, the same as one that does not exist', async () => {
        const group = await makeGroup(ana);
        const theirs = await befriend(bruno, carla);
        const notAFriend = await makeGroup(ana);

        for (const friend of [theirs.id, crypto.randomUUID(), notAFriend.id]) {
            expect(await error(await putMember(ana, group.id, crypto.randomUUID(), { friend }), 422)).toBe(
                'unknown-friend'
            );
        }
        expect((await listGroups(ana)).find((candidate) => candidate.id === group.id)?.members).toHaveLength(1);
    });

    it('refuses a friend who is still a dummy', async () => {
        const group = await makeGroup(ana);
        const friend = await makeFriend(ana);

        expect(await error(await putMember(ana, group.id, crypto.randomUUID(), { friend: friend.id }), 409)).toBe(
            'not-a-user'
        );
    });

    it('refuses a friend who is in the group already', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);
        await addFriend(ana, group.id, friend.id);

        expect(await error(await putMember(ana, group.id, crypto.randomUUID(), { friend: friend.id }), 409)).toBe(
            'already-member'
        );
    });

    it('refuses a friend in a friend', async () => {
        const other = await makeFriend(ana, 'Bruno');
        const friend = await befriend(ana, bruno);

        const response = await putMember(ana, other.id, crypto.randomUUID(), {
            friend: friend.id,
            replaces: other.members[1]?.id,
        });

        expect(await error(response, 409)).toBe('direct');
        expect((await listGroups(bruno)).map((candidate) => candidate.id)).toEqual([friend.id]);
    });

    it(`refuses a friend who is in ${MAX_OPEN_GROUPS} open groups already`, async () => {
        for (let made = 0; made < MAX_OPEN_GROUPS; made++) await makeGroup(bruno);
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);

        expect(await error(await putMember(ana, group.id, crypto.randomUUID(), { friend: friend.id }), 409)).toBe(
            'too-many-groups'
        );
    });

    it(`refuses a new member past ${MAX_GROUP_MEMBERS}, and takes one in place of a dummy`, async () => {
        const dummies = Array.from({ length: MAX_GROUP_MEMBERS - 1 }, (_, index) => `Dummy ${index}`);
        const full = await makeGroup(ana, dummies);
        const friend = await befriend(ana, bruno);

        const response = await putMember(ana, full.id, crypto.randomUUID(), { friend: friend.id });
        const { group } = await addFriend(ana, full.id, friend.id, memberNamed(full, 'Dummy 0'));

        expect(await error(response, 409)).toBe('too-many-members');
        expect(group.members.filter((candidate) => candidate.leftAt === null)).toHaveLength(MAX_GROUP_MEMBERS);
    });
});

describe('PUT /api/groups/:groupId/members/:memberId, a friend in place of a dummy', () => {
    it('merges the dummy into the friend in the same write, and keeps the dummy', async () => {
        const group = await makeGroup(ana, ['Bruno', 'Carla']);
        const dummy = memberNamed(group, 'Bruno');
        const friend = await befriend(ana, bruno);

        const { id, group: after } = await addFriend(ana, group.id, friend.id, dummy);

        expect(member(after, id)).toMatchObject({ name: 'Bruno Díaz', claimed: true, leftAt: null });
        expect(member(after, dummy)).toEqual({
            id: dummy,
            name: 'Bruno',
            role: 'member',
            claimed: false,
            leftAt: expect.any(Number),
            mergedInto: id,
        });
        expect(member(after, memberNamed(group, 'Carla'))).toMatchObject({ leftAt: null, mergedInto: null });
    });

    it('merges nothing when the friend can’t be added', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const dummy = memberNamed(group, 'Bruno');
        const theirs = await makeGroup(carla, ['Dani']);
        const friend = await befriend(ana, bruno);

        const response = await putMember(ana, group.id, memberNamed(theirs, 'Dani'), {
            friend: friend.id,
            replaces: dummy,
        });

        expect(await error(response, 409)).toBe('id-taken');
        expect(
            member((await listGroups(ana)).find((candidate) => candidate.id === group.id) ?? group, dummy)
        ).toMatchObject({
            leftAt: null,
            mergedInto: null,
        });
        expect((await listGroups(bruno)).map((candidate) => candidate.id)).toEqual([friend.id]);
    });

    it('lets nobody but the owner add a friend in place of a dummy, and any member add them as someone new', async () => {
        const { group } = await tripWithBruno(['Carla']);
        const dummy = memberNamed(group, 'Carla');
        const friend = await befriend(bruno, carla);

        const replacing = await putMember(bruno, group.id, crypto.randomUUID(), { friend: friend.id, replaces: dummy });
        const added = await addFriend(bruno, group.id, friend.id);

        expect(await error(replacing, 403)).toBe('not-owner');
        expect(member(added.group, dummy)).toMatchObject({ leftAt: null, mergedInto: null });
        expect(member(added.group, added.id)?.name).toBe('Carla Ruiz');
    });

    it('refuses to replace a member who is a user', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);

        const response = await putMember(ana, group.id, crypto.randomUUID(), { friend: friend.id, replaces: group.me });

        expect(await error(response, 409)).toBe('not-placeholder');
    });

    it('refuses to replace a member the group doesn’t have, or one who has left', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const dummy = memberNamed(group, 'Bruno');
        await addFriend(ana, group.id, (await befriend(ana, bruno)).id, dummy);
        const toCarla = await befriend(ana, carla);

        const unknown = await putMember(ana, group.id, crypto.randomUUID(), {
            friend: toCarla.id,
            replaces: crypto.randomUUID(),
        });
        const merged = await putMember(ana, group.id, crypto.randomUUID(), { friend: toCarla.id, replaces: dummy });

        expect(await error(unknown, 422)).toBe('unknown-member');
        expect(await error(merged, 422)).toBe('member-left');
    });
});

describe('DELETE /api/groups/:groupId/members/:memberId', () => {
    it('lets a member leave once their balance is zero, keeps their row and closes the group for them', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await seedEntry(group.id, { paidBy: group.me, shares: { [group.me]: 500, [brunoId]: 500 } });
        await seedEntry(group.id, { paidBy: brunoId, shares: { [group.me]: 500 }, kind: 'settlement' });

        const left = await groupOf(await removeMember(bruno, group.id, brunoId));

        expect(left).toMatchObject({ id: group.id, closed: 'left', me: brunoId });
        expect(member(left, brunoId)?.leftAt).toEqual(expect.any(Number));
        expect((await listGroups(bruno)).find((candidate) => candidate.id === group.id)?.closed).toBe('left');
        expect(await groupOfAna(group.id)).toMatchObject({ closed: null, members: left.members });
        const row = await env.DB.prepare('SELECT left_seq FROM shared_members WHERE id = ?1').bind(brunoId).first();
        expect(row?.left_seq).toBe(2);
    });

    it('refuses to let a member leave while they owe or are owed, and leaves them in', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await seedEntry(group.id, { paidBy: group.me, shares: { [group.me]: 500, [brunoId]: 500 } });

        expect(await error(await removeMember(bruno, group.id, brunoId), 409)).toBe('unsettled');
        expect(member(await groupOfAna(group.id), brunoId)?.leftAt).toBeNull();
    });

    it('leaves deleted entries out of the balance', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await seedEntry(group.id, { paidBy: group.me, shares: { [brunoId]: 500 }, deletedAt: 2 });

        expect((await removeMember(bruno, group.id, brunoId)).status).toBe(200);
    });

    it('counts the balance of a dummy merged into the member', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const dummy = memberNamed(group, 'Bruno');
        await seedEntry(group.id, { paidBy: group.me, shares: { [dummy]: 800 } });
        const { id } = await addFriend(ana, group.id, (await befriend(ana, bruno)).id, dummy);

        expect(await error(await removeMember(bruno, group.id, id), 409)).toBe('unsettled');
    });

    it('never lets the owner leave', async () => {
        const group = await makeGroup(ana, ['Bruno']);

        expect(await error(await removeMember(ana, group.id, group.me), 409)).toBe('owner');
        expect((await groupOfAna(group.id)).closed).toBeNull();
    });

    it('lets the owner remove a dummy or a member once their balance is zero', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Carla']);
        const carlaId = memberNamed(group, 'Carla');

        await groupOf(await removeMember(ana, group.id, carlaId));
        const after = await groupOf(await removeMember(ana, group.id, brunoId));

        expect(member(after, carlaId)?.leftAt).toEqual(expect.any(Number));
        expect(member(after, brunoId)?.leftAt).toEqual(expect.any(Number));
        expect(after.members).toHaveLength(3);
        expect((await listGroups(bruno)).find((candidate) => candidate.id === group.id)?.closed).toBe('left');
    });

    it('refuses to remove a dummy with a balance', async () => {
        const group = await makeGroup(ana, ['Carla']);
        const carlaId = memberNamed(group, 'Carla');
        await seedEntry(group.id, { paidBy: carlaId, shares: { [group.me]: 300 } });

        expect(await error(await removeMember(ana, group.id, carlaId), 409)).toBe('unsettled');
    });

    it('lets nobody but the owner remove another member', async () => {
        const { group } = await tripWithBruno(['Carla']);

        const response = await removeMember(bruno, group.id, memberNamed(group, 'Carla'));

        expect(await error(response, 403)).toBe('not-owner');
        expect(member(await groupOfAna(group.id), memberNamed(group, 'Carla'))?.leftAt).toBeNull();
    });

    it('takes nobody out of a friend: a friend is deleted instead', async () => {
        const friend = await befriend(ana, bruno);

        expect(await error(await removeMember(ana, friend.id, friend.b), 409)).toBe('direct');
        expect(await error(await removeMember(bruno, friend.id, friend.b), 409)).toBe('direct');
    });

    it('answers the group when it is sent again', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const first = await groupOf(await removeMember(bruno, group.id, brunoId));

        const again = await groupOf(await removeMember(bruno, group.id, brunoId));

        expect(again).toEqual(first);
    });

    it('answers 404 for a member the group doesn’t have', async () => {
        const group = await makeGroup(ana);

        expect(await error(await removeMember(ana, group.id, crypto.randomUUID()), 404)).toBe('unknown-member');
    });
});

describe('POST /api/groups/:groupId/members/:memberId/merge', () => {
    it('lets the owner merge a dummy into a member who is a user, whose balance it becomes', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Bruno', 'Carla']);
        const dummy = memberNamed(group, 'Bruno');
        await seedEntry(group.id, { paidBy: group.me, shares: { [dummy]: 600 } });

        const after = await groupOf(await merge(ana, group.id, dummy, brunoId));

        expect(member(after, dummy)).toEqual({
            id: dummy,
            name: 'Bruno',
            role: 'member',
            claimed: false,
            leftAt: expect.any(Number),
            mergedInto: brunoId,
        });
        expect(member(after, memberNamed(group, 'Carla'))).toMatchObject({ leftAt: null, mergedInto: null });
        expect(await error(await removeMember(bruno, group.id, brunoId), 409)).toBe('unsettled');
    });

    it('answers the group when it is sent again', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Bruno']);
        const dummy = memberNamed(group, 'Bruno');
        const first = await groupOf(await merge(ana, group.id, dummy, brunoId));

        expect(await groupOf(await merge(ana, group.id, dummy, brunoId))).toEqual(first);
    });

    it('merges a dummy only into a member who is a user, never into a dummy or into itself', async () => {
        const { group } = await tripWithBruno(['Carla', 'Dani']);
        const carlaId = memberNamed(group, 'Carla');

        const intoDummy = await merge(ana, group.id, carlaId, memberNamed(group, 'Dani'));
        const intoItself = await merge(ana, group.id, carlaId, carlaId);

        expect(await error(intoDummy, 409)).toBe('not-a-user');
        expect(await error(intoItself, 409)).toBe('into-itself');
        expect(member(await groupOfAna(group.id), carlaId)).toMatchObject({ leftAt: null, mergedInto: null });
    });

    it('never merges a member who is a user', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();

        expect(await error(await merge(ana, group.id, brunoId, group.me), 409)).toBe('not-placeholder');
        expect(await error(await merge(ana, group.id, group.me, brunoId), 409)).toBe('not-placeholder');
    });

    it('refuses a member the group doesn’t have, and one who has left, on either side', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Carla', 'Dani']);
        const carlaId = memberNamed(group, 'Carla');
        const daniId = memberNamed(group, 'Dani');
        await groupOf(await removeMember(ana, group.id, daniId));
        await groupOf(await removeMember(bruno, group.id, brunoId));

        expect(await error(await merge(ana, group.id, carlaId, crypto.randomUUID()), 422)).toBe('unknown-member');
        expect(await error(await merge(ana, group.id, carlaId, brunoId), 422)).toBe('member-left');
        expect(await error(await merge(ana, group.id, daniId, group.me), 409)).toBe('member-left');
        expect(await error(await merge(ana, group.id, crypto.randomUUID(), group.me), 404)).toBe('unknown-member');
    });

    it('lets nobody but the owner merge', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Bruno']);

        const response = await merge(bruno, group.id, memberNamed(group, 'Bruno'), brunoId);

        expect(await error(response, 403)).toBe('not-owner');
    });

    it('merges nothing in a friend', async () => {
        const friend = await makeFriend(ana);

        const response = await merge(ana, friend.id, friend.members[1]?.id ?? '', friend.me);

        expect(await error(response, 409)).toBe('direct');
    });
});

describe('a member who left', () => {
    it('can write nothing more to the group', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Carla']);
        await removeMember(bruno, group.id, brunoId);
        const toCarla = await befriend(bruno, carla);

        const writes = [
            putMember(bruno, group.id, crypto.randomUUID(), { name: 'Dani' }),
            putMember(bruno, group.id, brunoId, { name: 'Bru' }),
            putMember(bruno, group.id, crypto.randomUUID(), { friend: toCarla.id }),
            removeMember(bruno, group.id, memberNamed(group, 'Carla')),
        ];

        for (const response of await Promise.all(writes)) expect(await error(response, 409)).toBe('closed');
        expect((await groupOfAna(group.id)).members).toHaveLength(3);
    });

    it('makes room for another member', async () => {
        const dummies = Array.from({ length: MAX_GROUP_MEMBERS - 1 }, (_, index) => `Dummy ${index}`);
        const full = await makeGroup(ana, dummies);

        await groupOf(await removeMember(ana, full.id, memberNamed(full, 'Dummy 0')));

        expect((await putMember(ana, full.id, crypto.randomUUID(), { name: 'One more' })).status).toBe(200);
    });

    it('was in a friend that can’t be added once it is deleted', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);
        await groupOf(await send(ana, 'DELETE', `/groups/${friend.id}`));

        expect(await error(await putMember(ana, group.id, crypto.randomUUID(), { friend: friend.id }), 422)).toBe(
            'unknown-friend'
        );
    });
});

describe('a stranger', () => {
    it('gets the same 404 for a group of somebody else as for one that does not exist, and changes nothing', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const friend = await befriend(carla, bruno);

        const writes = [
            [group.id, crypto.randomUUID(), { name: 'Mallory' }],
            [group.id, memberNamed(group, 'Bruno'), { name: 'Mallory' }],
            [group.id, crypto.randomUUID(), { friend: friend.id }],
        ] as const;
        for (const [groupId, memberId, body] of writes) {
            const theirs = await putMember(carla, groupId, memberId, body);
            const missing = await putMember(carla, crypto.randomUUID(), memberId, body);
            expect(theirs.status).toBe(404);
            expect(await theirs.text()).toBe(await missing.text());
        }
        const merged = await merge(carla, group.id, memberNamed(group, 'Bruno'), group.me);
        const mergedMissing = await merge(carla, crypto.randomUUID(), memberNamed(group, 'Bruno'), group.me);
        expect(merged.status).toBe(404);
        expect(await merged.text()).toBe(await mergedMissing.text());
        const removed = await removeMember(carla, group.id, memberNamed(group, 'Bruno'));
        const removedMissing = await removeMember(carla, crypto.randomUUID(), memberNamed(group, 'Bruno'));
        expect(removed.status).toBe(404);
        expect(await removed.text()).toBe(await removedMissing.text());
        expect(await listGroups(ana)).toEqual([group]);
    });
});

describe('the rows', () => {
    it('keep a member’s user out of every answer', async () => {
        const { group } = await tripWithBruno();

        const response = await putMember(ana, group.id, crypto.randomUUID(), { name: 'Dani' });
        const text = await response.text();

        expect(text).not.toContain(bruno.userId);
        expect(text).not.toContain(ana.userId);
        const stored = await env.DB.prepare('SELECT COUNT(*) AS n FROM shared_members WHERE user_id = ?1')
            .bind(bruno.userId)
            .first();
        expect(stored?.n).toBe(2);
    });
});
