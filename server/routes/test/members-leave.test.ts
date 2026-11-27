import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_GROUP_MEMBERS, MAX_GROUP_MEMBER_ROWS } from '@core/groups/shared-group';
import { befriend, groupOf, listGroups, makeGroup, memberNamed, seedEntry, send } from '@server/testing/groups';
import { addDummy, addFriend, error, member, merge, putMember, removeMember } from '@server/testing/members';
import { signIn, type TestSession } from '@server/testing/session';

let ana: TestSession;
let bruno: TestSession;
let carla: TestSession;

async function tripWithBruno(dummies: string[] = []) {
    const group = await makeGroup(ana, dummies);
    const friend = await befriend(ana, bruno);
    const { id, group: joined } = await addFriend(ana, group.id, friend.id);
    return { group: joined, bruno: id };
}

async function groupOfAna(groupId: string) {
    const group = (await listGroups(ana)).find((candidate) => candidate.id === groupId);
    if (!group) throw new Error('Ana is not in the group');
    return group;
}

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
    carla = await signIn('carla@example.com', 'Carla Ruiz');
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

    it('lets a member who is settled leave while others in the group owe', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Carla']);
        await seedEntry(group.id, { paidBy: group.me, shares: { [memberNamed(group, 'Carla')]: 1000 } });

        const left = await groupOf(await removeMember(bruno, group.id, brunoId));

        expect(left.closed).toBe('left');
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
        const friend = await befriend(ana, bruno);

        const response = await merge(ana, friend.id, friend.b, friend.a);

        expect(await error(response, 409)).toBe('direct');
    });
});

describe('writes at the same moment', () => {
    it('add the same dummy once, and answer each the group', async () => {
        const group = await makeGroup(ana);
        const id = crypto.randomUUID();

        const responses = await Promise.all([1, 2, 3].map(() => putMember(ana, group.id, id, { name: 'Dani' })));

        for (const response of responses) expect((await groupOf(response)).members).toHaveLength(2);
    });

    it('add the same friend once, and answer each the group', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);
        const id = crypto.randomUUID();

        const responses = await Promise.all([1, 2, 3].map(() => putMember(ana, group.id, id, { friend: friend.id })));

        for (const response of responses) expect((await groupOf(response)).members).toHaveLength(2);
    });

    it(`never take a group past ${MAX_GROUP_MEMBERS} members`, async () => {
        const dummies = Array.from({ length: MAX_GROUP_MEMBERS - 2 }, (_, index) => `Dummy ${index}`);
        const group = await makeGroup(ana, dummies);

        const responses = await Promise.all(
            Array.from({ length: 6 }, (_, index) =>
                putMember(ana, group.id, crypto.randomUUID(), { name: `Someone ${index}` })
            )
        );

        expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
        for (const response of responses.filter((candidate) => candidate.status !== 200)) {
            expect(await error(response, 409)).toBe('too-many-members');
        }
        expect((await groupOfAna(group.id)).members).toHaveLength(MAX_GROUP_MEMBERS);
    });
});

describe('the people a group ever had', () => {
    async function rowsOfGroup(groupId: string) {
        const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM shared_members WHERE group_id = ?1')
            .bind(groupId)
            .first<{ n: number }>();
        return row?.n;
    }

    async function seedLeft(groupId: string, count: number) {
        const statements = Array.from({ length: count }, () =>
            env.DB.prepare(
                `INSERT INTO shared_members (id, group_id, name, role, created_at, left_at, left_seq)
                 VALUES (?1, ?2, 'Gone', 'member', 1, 2, 0)`
            ).bind(crypto.randomUUID(), groupId)
        );
        await env.DB.batch(statements);
    }

    it(`refuses a person once a group has had ${MAX_GROUP_MEMBER_ROWS}, though only one is in it`, async () => {
        const group = await makeGroup(ana);
        await seedLeft(group.id, MAX_GROUP_MEMBER_ROWS - 3);
        for (const name of ['Dummy 1', 'Dummy 2']) {
            const { id } = await addDummy(ana, group.id, name);
            await groupOf(await removeMember(ana, group.id, id));
        }
        expect(await rowsOfGroup(group.id)).toBe(MAX_GROUP_MEMBER_ROWS);

        const response = await putMember(ana, group.id, crypto.randomUUID(), { name: 'One more' });

        expect(await error(response, 409)).toBe('too-many-members-ever');
        expect(await rowsOfGroup(group.id)).toBe(MAX_GROUP_MEMBER_ROWS);
        expect((await groupOfAna(group.id)).members.filter((member) => member.leftAt === null)).toHaveLength(1);
    });

    it('refuses a friend, and a friend in place of a dummy, as it does a dummy', async () => {
        const group = await makeGroup(ana, ['Dani']);
        const toBruno = await befriend(ana, bruno);
        await seedLeft(group.id, MAX_GROUP_MEMBER_ROWS - 2);

        const added = await putMember(ana, group.id, crypto.randomUUID(), { friend: toBruno.id });
        const replacing = await putMember(ana, group.id, crypto.randomUUID(), {
            friend: toBruno.id,
            replaces: memberNamed(group, 'Dani'),
        });

        expect(await error(added, 409)).toBe('too-many-members-ever');
        expect(await error(replacing, 409)).toBe('too-many-members-ever');
        expect(await rowsOfGroup(group.id)).toBe(MAX_GROUP_MEMBER_ROWS);
        expect(member(await groupOfAna(group.id), memberNamed(group, 'Dani'))).toMatchObject({ mergedInto: null });
    });

    it('takes the last place, and says the group is full when it is the people in it that are too many', async () => {
        const group = await makeGroup(ana);
        await seedLeft(group.id, MAX_GROUP_MEMBER_ROWS - 2);
        await addDummy(ana, group.id, 'Last');
        const dummies = Array.from({ length: MAX_GROUP_MEMBERS - 1 }, (_, index) => `Dummy ${index}`);
        const crowded = await makeGroup(ana, dummies);

        const refused = await putMember(ana, group.id, crypto.randomUUID(), { name: 'Late' });
        const full = await putMember(ana, crowded.id, crypto.randomUUID(), { name: 'Late' });

        expect(await error(refused, 409)).toBe('too-many-members-ever');
        expect(await error(full, 409)).toBe('too-many-members');
        expect(await rowsOfGroup(group.id)).toBe(MAX_GROUP_MEMBER_ROWS);
    });

    it('never takes a group past the rows at the same moment', async () => {
        const group = await makeGroup(ana);
        await seedLeft(group.id, MAX_GROUP_MEMBER_ROWS - 3);

        const responses = await Promise.all(
            Array.from({ length: 6 }, (_, index) =>
                putMember(ana, group.id, crypto.randomUUID(), { name: `Someone ${index}` })
            )
        );

        expect(responses.filter((response) => response.status === 200)).toHaveLength(2);
        expect(await rowsOfGroup(group.id)).toBe(MAX_GROUP_MEMBER_ROWS);
    });
});

describe('what is done already in an open group', () => {
    it('answers the owner the group when the handover is sent again', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await groupOf(await send(ana, 'POST', `/groups/${group.id}/owner`, { memberId: brunoId }));

        const again = await send(bruno, 'POST', `/groups/${group.id}/owner`, { memberId: brunoId });

        expect(member(await groupOf(again), brunoId)?.role).toBe('owner');
    });

    it('answers the owner the group when the merge is sent again', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        await groupOf(await merge(ana, group.id, dani, brunoId));

        const again = await groupOf(await merge(ana, group.id, dani, brunoId));

        expect(member(again, dani)?.mergedInto).toBe(brunoId);
    });

    it('answers the group when a removal is sent again, also by somebody else', async () => {
        const { group } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        await groupOf(await removeMember(ana, group.id, dani));

        expect(member(await groupOf(await removeMember(ana, group.id, dani)), dani)?.leftAt).not.toBeNull();
        expect(member(await groupOf(await removeMember(bruno, group.id, dani)), dani)?.leftAt).not.toBeNull();
    });

    it('answers a member the group when their own leave is sent again', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await groupOf(await removeMember(bruno, group.id, brunoId));

        const again = await groupOf(await removeMember(bruno, group.id, brunoId));

        expect(again).toMatchObject({ closed: 'left', me: brunoId });
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
