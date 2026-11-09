import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    MAX_CLOSED_GROUPS,
    MAX_GROUP_MEMBERS,
    MAX_GROUP_MEMBER_ROWS,
    MAX_OPEN_GROUPS,
    SHARED_NAME_MAX_LENGTH,
} from '@core/shared-group';
import {
    befriend,
    groupOf,
    listGroups,
    makeGroup,
    memberNamed,
    racingEnv,
    seedClosedGroups,
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

    it('reads the ids of the path in upper case as the same group and member', async () => {
        const group = await makeGroup(ana);
        const id = crypto.randomUUID();
        await putMember(ana, group.id, id, { name: 'Dani' });

        const again = await groupOf(await putMember(ana, group.id.toUpperCase(), id.toUpperCase(), { name: 'Dani' }));

        expect(again.members.map((candidate) => candidate.id)).toEqual([group.me, id]);
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
        const friend = await befriend(ana, bruno);

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

    it('cuts the name of a friend whose account name is too long to what a group takes', async () => {
        const dani = await signIn('dani@example.com', 'x'.repeat(120));
        const group = await makeGroup(ana);

        const { id, group: after } = await addFriend(ana, group.id, (await befriend(ana, dani)).id);

        expect(member(after, id)?.name).toBe('x'.repeat(SHARED_NAME_MAX_LENGTH));
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

    it('takes as a friend only a friend, never another group the caller shares with that person', async () => {
        const group = await makeGroup(ana);
        const { group: withBruno } = await tripWithBruno();

        const response = await putMember(ana, group.id, crypto.randomUUID(), { friend: withBruno.id });

        expect(await error(response, 422)).toBe('unknown-friend');
        expect((await listGroups(bruno)).some((candidate) => candidate.id === group.id)).toBe(false);
    });

    it('answers 409 id-taken to a member id sent again for another person', async () => {
        const group = await makeGroup(ana, ['Dani']);
        const toBruno = await befriend(ana, bruno);
        const toCarla = await befriend(ana, carla);
        const { id } = await addFriend(ana, group.id, toBruno.id);

        const otherFriend = await putMember(ana, group.id, id, { friend: toCarla.id });
        const onADummy = await putMember(ana, group.id, memberNamed(group, 'Dani'), { friend: toCarla.id });

        expect(await error(otherFriend, 409)).toBe('id-taken');
        expect(await error(onADummy, 409)).toBe('id-taken');
        expect((await groupOfAna(group.id)).members).toHaveLength(3);
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

    it('refuses a friend whose other side deleted their account, as it does any closed friend', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);
        await send(bruno, 'DELETE', '/account', { email: 'bruno@example.com' });

        expect(await error(await putMember(ana, group.id, crypto.randomUUID(), { friend: friend.id }), 422)).toBe(
            'unknown-friend'
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
        const other = await befriend(ana, carla);
        const friend = await befriend(ana, bruno);

        const response = await putMember(ana, other.id, crypto.randomUUID(), { friend: friend.id, replaces: other.b });

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

describe('PUT /api/groups/:groupId/members/:memberId, a friend who left', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    async function afterBrunoLeft(dummies: string[] = []) {
        const group = await makeGroup(ana, dummies);
        const friend = await befriend(ana, bruno);
        const { id } = await addFriend(ana, group.id, friend.id);
        await groupOf(await removeMember(bruno, group.id, id));
        return { group, friend: friend.id, bruno: id };
    }

    function comeBack(as: TestSession, groupId: string, friend: string, replaces?: string, bindings?: typeof env) {
        const body = { friend, replaces };
        return send(as, 'PUT', `/groups/${groupId}/members/${crypto.randomUUID()}`, body, bindings);
    }

    async function rowOf(memberId: string) {
        return env.DB.prepare(
            'SELECT left_at, left_seq, archived_at, created_at, role, name FROM shared_members WHERE id = ?1'
        )
            .bind(memberId)
            .first<{
                left_at: number | null;
                left_seq: number | null;
                archived_at: number | null;
                created_at: number;
                role: string;
                name: string;
            }>();
    }

    async function rowsOf(groupId: string, userId: string) {
        const row = await env.DB.prepare(
            'SELECT COUNT(*) AS n FROM shared_members WHERE group_id = ?1 AND user_id = ?2'
        )
            .bind(groupId, userId)
            .first<{ n: number }>();
        return row?.n;
    }

    async function entryIds(as: TestSession, groupId: string) {
        const response = await send(as, 'GET', `/groups/${groupId}/entries?after=0`);
        return ((await response.json()) as { entries: Array<{ id: string }> }).entries.map((entry) => entry.id);
    }

    function dinner(paidBy: string, shares: Record<string, number>, overrides: Record<string, unknown> = {}) {
        const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
        return {
            kind: 'expense',
            text: 'Dinner',
            categoryId: 'food',
            amountCents: list.reduce((sum, share) => sum + share.cents, 0),
            currency: 'EUR',
            date: '2026-10-25',
            paidBy,
            split: 'exact',
            shares: list,
            createdAt: 1_000,
            updatedAt: 1_000,
            deletedAt: null,
            ...overrides,
        };
    }

    function settlement(paidBy: string, to: string, cents: number) {
        return {
            kind: 'settlement',
            text: '',
            amountCents: cents,
            currency: 'EUR',
            date: '2026-10-26',
            paidBy,
            shares: [{ memberId: to, cents }],
            createdAt: 1_000,
            updatedAt: 1_000,
            deletedAt: null,
        };
    }

    function putEntry(as: TestSession, groupId: string, id: string, body: unknown) {
        return send(as, 'PUT', `/groups/${groupId}/entries/${id}`, body);
    }

    async function write(as: TestSession, groupId: string, id: string, body: unknown) {
        expect((await putEntry(as, groupId, id, body)).status).toBe(200);
    }

    it('reopens the row they left, not a second one, so the group is open for them again', async () => {
        const trip = await afterBrunoLeft(['Dani']);
        const before = (await groupOfAna(trip.group.id)).members.map((candidate) => candidate.id);
        const asked = crypto.randomUUID();

        const back = await groupOf(await putMember(ana, trip.group.id, asked, { friend: trip.friend }));

        expect(member(back, trip.bruno)).toEqual({
            id: trip.bruno,
            name: 'Bruno Díaz',
            role: 'member',
            claimed: true,
            leftAt: null,
            mergedInto: null,
        });
        expect(member(back, asked)).toBeUndefined();
        expect(back.members.map((candidate) => candidate.id)).toEqual(before);
        expect(await rowsOf(trip.group.id, bruno.userId)).toBe(1);
        expect(await rowOf(trip.bruno)).toMatchObject({ left_at: null, left_seq: null, archived_at: null });
        const theirs = (await listGroups(bruno)).find((candidate) => candidate.id === trip.group.id);
        expect(theirs).toEqual({ ...back, me: trip.bruno });
    });

    it('brings back a member the owner removed, and lets any member who has them as a friend do it', async () => {
        const group = await makeGroup(ana);
        const { id: carlaId } = await addFriend(ana, group.id, (await befriend(ana, carla)).id);
        const toBruno = await befriend(carla, bruno);
        const { id: brunoId } = await addFriend(carla, group.id, toBruno.id);
        await groupOf(await removeMember(ana, group.id, brunoId));
        expect((await listGroups(bruno))[0]).toMatchObject({ closed: 'left' });

        const back = await groupOf(await comeBack(carla, group.id, toBruno.id));

        expect(member(back, brunoId)).toMatchObject({ leftAt: null });
        expect(member(back, carlaId)).toMatchObject({ leftAt: null });
        expect((await listGroups(bruno)).find((candidate) => candidate.id === group.id)).toMatchObject({
            closed: null,
            me: brunoId,
        });
    });

    it('keeps what the group calls them, their switch and their place, and takes the group out of the archive', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);
        const { id } = await addFriend(ana, group.id, friend.id);
        await groupOf(await putMember(bruno, group.id, id, { name: 'Bru' }));
        await groupOf(await send(bruno, 'PUT', `/groups/${group.id}/me`, { showInExpenses: false }));
        await groupOf(await removeMember(bruno, group.id, id));
        await groupOf(await send(bruno, 'PUT', `/groups/${group.id}/me`, { archived: true }));
        const left = await rowOf(id);

        await groupOf(await comeBack(ana, group.id, friend.id));

        const theirs = (await listGroups(bruno)).find((candidate) => candidate.id === group.id);
        expect(theirs).toMatchObject({ closed: null, archived: false, showInExpenses: false, me: id });
        expect(member(theirs!, id)).toMatchObject({ name: 'Bru', role: 'member' });
        expect(await rowOf(id)).toEqual({ ...left, left_at: null, left_seq: null, archived_at: null });
    });

    it('shows them the people who joined while they were away, and what they can write once more', async () => {
        const trip = await afterBrunoLeft();
        vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60_000 });
        const { id: dani } = await addDummy(ana, trip.group.id, 'Dani');
        const theirs = async () => (await listGroups(bruno)).find((candidate) => candidate.id === trip.group.id);
        expect((await theirs())?.members.map((candidate) => candidate.id)).toEqual([trip.group.me, trip.bruno]);

        await groupOf(await comeBack(ana, trip.group.id, trip.friend));

        expect((await theirs())?.members.map((candidate) => candidate.id)).toEqual([trip.group.me, trip.bruno, dani]);
        const written = await putEntry(bruno, trip.group.id, crypto.randomUUID(), dinner(trip.bruno, { [dani]: 300 }));
        expect(written.status).toBe(200);
    });

    it('lets them read what the group wrote while they were away, and edit what named them before', async () => {
        const group = await makeGroup(ana);
        const friend = await befriend(ana, bruno);
        const { id: brunoId } = await addFriend(ana, group.id, friend.id);
        const [first, settled, whileAway] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
        await write(ana, group.id, first, dinner(group.me, { [group.me]: 500, [brunoId]: 500 }));
        await write(bruno, group.id, settled, settlement(brunoId, group.me, 500));
        await groupOf(await removeMember(bruno, group.id, brunoId));
        await write(ana, group.id, whileAway, dinner(group.me, { [group.me]: 700 }));
        const edited = dinner(group.me, { [group.me]: 500, [brunoId]: 500 }, { text: 'Edited', updatedAt: 2_000 });
        await write(ana, group.id, first, edited);
        expect(await entryIds(bruno, group.id)).toEqual([settled]);
        expect((await putEntry(bruno, group.id, first, edited)).status).toBe(409);

        await groupOf(await comeBack(ana, group.id, friend.id));

        expect(await entryIds(bruno, group.id)).toEqual([settled, whileAway, first]);
        const shares = { [group.me]: 400, [brunoId]: 600 };
        await write(bruno, group.id, first, dinner(group.me, shares, { text: 'Edited again', updatedAt: 3_000 }));
    });

    it('refuses a friend who has not left, also right after they came back', async () => {
        const trip = await afterBrunoLeft();
        await groupOf(await comeBack(ana, trip.group.id, trip.friend));

        const again = await comeBack(ana, trip.group.id, trip.friend);

        expect(await error(again, 409)).toBe('already-member');
        expect(await rowsOf(trip.group.id, bruno.userId)).toBe(1);
    });

    it('brings nobody back past the people a group holds, and does when the dummy they replace makes room', async () => {
        const dummies = Array.from({ length: MAX_GROUP_MEMBERS - 2 }, (_, index) => `Dummy ${index}`);
        const trip = await afterBrunoLeft(dummies);
        await addDummy(ana, trip.group.id, 'Late');

        const full = await comeBack(ana, trip.group.id, trip.friend);
        const replacing = await comeBack(ana, trip.group.id, trip.friend, memberNamed(trip.group, 'Dummy 0'));

        expect(await error(full, 409)).toBe('too-many-members');
        const back = await groupOf(replacing);
        expect(back.members.filter((candidate) => candidate.leftAt === null)).toHaveLength(MAX_GROUP_MEMBERS);
        expect(member(back, trip.bruno)).toMatchObject({ leftAt: null });
    });

    it('leaves the row as it was when they are in the open groups a person can be in already', async () => {
        const trip = await afterBrunoLeft(['Dani']);
        for (let made = 0; made < MAX_OPEN_GROUPS; made++) await makeGroup(bruno);
        const before = await rowOf(trip.bruno);

        const refused = await comeBack(ana, trip.group.id, trip.friend, memberNamed(trip.group, 'Dani'));

        expect(await error(refused, 409)).toBe('too-many-groups');
        expect(await rowOf(trip.bruno)).toEqual(before);
        expect(member(await groupOfAna(trip.group.id), memberNamed(trip.group, 'Dani'))).toMatchObject({
            mergedInto: null,
        });
    });

    it('does not count the closed groups, since this one stops being one for them', async () => {
        const trip = await afterBrunoLeft();
        await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS - 1);
        const other = await makeGroup(ana);
        expect(await error(await comeBack(ana, other.id, trip.friend), 409)).toBe('too-many-closed-groups');

        const back = await groupOf(await comeBack(ana, trip.group.id, trip.friend));

        expect(member(back, trip.bruno)).toMatchObject({ leftAt: null });
    });

    it('does not count the rows of the group, since no row is made', async () => {
        const trip = await afterBrunoLeft();
        const gone = Array.from({ length: MAX_GROUP_MEMBER_ROWS - 2 }, () =>
            env.DB.prepare(
                `INSERT INTO shared_members (id, group_id, name, role, created_at, left_at, left_seq)
                 VALUES (?1, ?2, 'Gone', 'member', 1, 2, 0)`
            ).bind(crypto.randomUUID(), trip.group.id)
        );
        await env.DB.batch(gone);
        expect(await error(await putMember(ana, trip.group.id, crypto.randomUUID(), { name: 'More' }), 409)).toBe(
            'too-many-members-ever'
        );

        await groupOf(await comeBack(ana, trip.group.id, trip.friend));

        expect(await rowsOf(trip.group.id, bruno.userId)).toBe(1);
    });

    it('puts a friend in place of a dummy who comes back, merging the dummy into the row they had', async () => {
        const trip = await afterBrunoLeft(['Dani', 'Eva']);
        const dani = memberNamed(trip.group, 'Dani');

        const back = await groupOf(await comeBack(ana, trip.group.id, trip.friend, dani));

        expect(member(back, trip.bruno)).toMatchObject({ leftAt: null, mergedInto: null });
        expect(member(back, dani)).toMatchObject({ leftAt: expect.any(Number), mergedInto: trip.bruno });
        expect(member(back, memberNamed(trip.group, 'Eva'))).toMatchObject({ leftAt: null, mergedInto: null });
        expect(back.members).toHaveLength(trip.group.members.length + 1);
    });

    it('lets nobody but the owner bring a friend back in place of a dummy, and any member as someone new', async () => {
        const trip = await afterBrunoLeft(['Dani']);
        const { id: carlaId } = await addFriend(ana, trip.group.id, (await befriend(ana, carla)).id);
        const toBruno = await befriend(carla, bruno);

        const replacing = await comeBack(carla, trip.group.id, toBruno.id, memberNamed(trip.group, 'Dani'));
        const back = await groupOf(await comeBack(carla, trip.group.id, toBruno.id));

        expect(await error(replacing, 403)).toBe('not-owner');
        expect(member(back, trip.bruno)).toMatchObject({ leftAt: null });
        expect(member(back, memberNamed(trip.group, 'Dani'))).toMatchObject({ leftAt: null, mergedInto: null });
        expect(member(back, carlaId)).toMatchObject({ leftAt: null });
    });

    it('is told it is open, and merges nothing, when another request brought them back first', async () => {
        const trip = await afterBrunoLeft(['Dani']);
        const dani = memberNamed(trip.group, 'Dani');
        const overtaken = racingEnv('left_at = NULL', async () => {
            await groupOf(await comeBack(ana, trip.group.id, trip.friend));
        });

        const response = await comeBack(ana, trip.group.id, trip.friend, dani, overtaken);

        expect(await error(response, 409)).toBe('already-member');
        expect(member(await groupOfAna(trip.group.id), dani)).toMatchObject({ leftAt: null, mergedInto: null });
        expect(await rowsOf(trip.group.id, bruno.userId)).toBe(1);
    });

    it('reopens the row once when asked at the same moment, and tells the others it is open', async () => {
        const trip = await afterBrunoLeft();

        const responses = await Promise.all([1, 2, 3, 4].map(() => comeBack(ana, trip.group.id, trip.friend)));

        expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
        for (const response of responses.filter((candidate) => candidate.status !== 200)) {
            expect(await error(response, 409)).toBe('already-member');
        }
        expect(await rowsOf(trip.group.id, bruno.userId)).toBe(1);
    });

    it('is told the group is closed when it was deleted, also at the moment they come back', async () => {
        const trip = await afterBrunoLeft();
        const deleting = racingEnv('left_at = NULL', async () => {
            await groupOf(await send(ana, 'DELETE', `/groups/${trip.group.id}`));
        });

        const overtaken = await comeBack(ana, trip.group.id, trip.friend, undefined, deleting);

        expect(await error(overtaken, 409)).toBe('closed');
        expect((await rowOf(trip.bruno))?.left_at).not.toBeNull();
        expect(await error(await comeBack(ana, trip.group.id, trip.friend), 409)).toBe('closed');
    });

    it('is not for a stranger, who gets the 404 of a group that does not exist', async () => {
        const trip = await afterBrunoLeft();
        const toBruno = await befriend(carla, bruno);

        const theirs = await comeBack(carla, trip.group.id, toBruno.id);
        const missing = await comeBack(carla, crypto.randomUUID(), toBruno.id);

        expect(theirs.status).toBe(404);
        expect(await theirs.text()).toBe(await missing.text());
        expect((await rowOf(trip.bruno))?.left_at).not.toBeNull();
    });

    it('is not for the member who left, who can write nothing to the group', async () => {
        const trip = await afterBrunoLeft();
        const toCarla = await befriend(bruno, carla);

        const response = await comeBack(bruno, trip.group.id, toCarla.id);

        expect(await error(response, 409)).toBe('closed');
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

describe('a member who left', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('sees only the people who were there when they left, as they were then, even once the group is deleted', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Eva']);
        const eva = memberNamed(group, 'Eva');
        const left = await groupOf(await removeMember(bruno, group.id, brunoId));
        vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60_000 });

        await addDummy(ana, group.id, 'Dani');
        await addFriend(ana, group.id, (await befriend(ana, carla)).id, eva);
        const theirs = async () => (await listGroups(bruno)).find((candidate) => candidate.id === group.id);

        expect((await theirs())?.members).toEqual(left.members);
        expect(member((await theirs()) ?? left, eva)).toMatchObject({ leftAt: null, mergedInto: null });
        expect((await groupOfAna(group.id)).members).toHaveLength(5);

        await groupOf(await send(ana, 'DELETE', `/groups/${group.id}`));

        expect(await theirs()).toEqual({ ...left, closed: 'left' });
        expect((await groupOfAna(group.id)).closed).toBe('deleted');
    });

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

describe('a member who left, asking about what came after', () => {
    function handOver(as: TestSession, groupId: string, memberId: string) {
        return send(as, 'POST', `/groups/${groupId}/owner`, { memberId });
    }

    async function afterCarlaLeft() {
        const group = await makeGroup(ana, ['Dani', 'Eva']);
        const carlaId = (await addFriend(ana, group.id, (await befriend(ana, carla)).id)).id;
        const brunoId = (await addFriend(ana, group.id, (await befriend(ana, bruno)).id)).id;
        await groupOf(await removeMember(carla, group.id, carlaId));
        const dani = memberNamed(group, 'Dani');
        const eva = memberNamed(group, 'Eva');
        await groupOf(await handOver(ana, group.id, brunoId));
        await groupOf(await merge(bruno, group.id, dani, group.me));
        await groupOf(await removeMember(bruno, group.id, eva));
        return { groupId: group.id, ana: group.me, bruno: brunoId, carla: carlaId, dani, eva };
    }

    it.each([
        ['the owner now', 'bruno'],
        ['the owner before', 'ana'],
        ['somebody who is not in the group', 'nobody'],
    ] as const)('gets 409 closed to a handover to %s', async (_, whom) => {
        const trip = await afterCarlaLeft();
        const memberId = whom === 'nobody' ? crypto.randomUUID() : trip[whom];

        const response = await handOver(carla, trip.groupId, memberId);

        expect(await error(response, 409)).toBe('closed');
    });

    it.each([
        ['the member it was merged into', 'dani', 'ana'],
        ['another member', 'dani', 'bruno'],
        ['a member who left', 'eva', 'ana'],
        ['somebody who is not in the group', 'dani', 'nobody'],
        ['itself', 'dani', 'dani'],
    ] as const)('gets 409 closed to a merge of a dummy into %s', async (_, dummy, into) => {
        const trip = await afterCarlaLeft();
        const target = into === 'nobody' ? crypto.randomUUID() : trip[into];

        const response = await merge(carla, trip.groupId, trip[dummy], target);

        expect(await error(response, 409)).toBe('closed');
    });

    it.each([
        ['a dummy merged since', 'dani'],
        ['a dummy removed since', 'eva'],
        ['the owner now', 'bruno'],
        ['the owner before', 'ana'],
        ['somebody who is not in the group', 'nobody'],
    ] as const)('gets 409 closed to the removal of %s', async (_, whom) => {
        const trip = await afterCarlaLeft();
        const memberId = whom === 'nobody' ? crypto.randomUUID() : trip[whom];

        const response = await removeMember(carla, trip.groupId, memberId);

        expect(await error(response, 409)).toBe('closed');
    });

    it('gets 409 closed to a name sent for a member, whatever it is', async () => {
        const trip = await afterCarlaLeft();

        for (const name of ['Dani', 'Daniela', 'Bruno Díaz']) {
            const response = await putMember(carla, trip.groupId, trip.dani, { name });
            expect(await error(response, 409)).toBe('closed');
        }
    });

    it('gets 409 closed to a delete of the group, whether or not it was deleted since', async () => {
        const trip = await afterCarlaLeft();
        expect(await error(await send(carla, 'DELETE', `/groups/${trip.groupId}`), 409)).toBe('closed');

        await groupOf(await send(bruno, 'DELETE', `/groups/${trip.groupId}`));

        expect(await error(await send(carla, 'DELETE', `/groups/${trip.groupId}`), 409)).toBe('closed');
    });

    it('is still told its own leave, sent again', async () => {
        const trip = await afterCarlaLeft();

        const again = await groupOf(await removeMember(carla, trip.groupId, trip.carla));

        expect(again.closed).toBe('left');
    });

    it('sees the owner as it is now, and nothing else of what came after', async () => {
        const trip = await afterCarlaLeft();

        const theirs = (await listGroups(carla)).find((candidate) => candidate.id === trip.groupId);

        expect(theirs?.members.find((candidate) => candidate.role === 'owner')?.id).toBe(trip.bruno);
        expect(member(theirs!, trip.dani)).toMatchObject({ leftAt: null, mergedInto: null });
        expect(member(theirs!, trip.eva)).toMatchObject({ leftAt: null, mergedInto: null });
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

describe('PUT /api/groups/:groupId/members/:memberId, a friend with closed groups', () => {
    it(`adds a friend with ${MAX_CLOSED_GROUPS - 1} closed groups, and refuses one with ${MAX_CLOSED_GROUPS}, to the one who adds`, async () => {
        const group = await makeGroup(ana);
        const toBruno = await befriend(ana, bruno);
        await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS - 1);
        await addFriend(ana, group.id, toBruno.id);
        const other = await makeGroup(ana);
        await seedClosedGroups(bruno.userId, 1, 'left');

        const response = await putMember(ana, other.id, crypto.randomUUID(), { friend: toBruno.id });

        expect(await error(response, 409)).toBe('too-many-closed-groups');
        expect((await groupOfAna(other.id)).members).toHaveLength(1);
    });

    it('adds a friend again once they archive the closed groups other people piled onto them', async () => {
        const toBruno = await befriend(ana, bruno);
        const piled = await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS);
        const group = await makeGroup(ana);
        expect(await error(await putMember(ana, group.id, crypto.randomUUID(), { friend: toBruno.id }), 409)).toBe(
            'too-many-closed-groups'
        );

        await send(bruno, 'PUT', `/groups/${piled[0]}/me`, { archived: true });

        await addFriend(ana, group.id, toBruno.id);
    });

    it('refuses to put a friend in place of a dummy, as it does to add one', async () => {
        const group = await makeGroup(ana, ['Dani']);
        const toBruno = await befriend(ana, bruno);
        await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS);

        const response = await putMember(ana, group.id, crypto.randomUUID(), {
            friend: toBruno.id,
            replaces: memberNamed(group, 'Dani'),
        });

        expect(await error(response, 409)).toBe('too-many-closed-groups');
        expect(member(await groupOfAna(group.id), memberNamed(group, 'Dani'))).toMatchObject({ mergedInto: null });
    });

    it('does not stop the friend from being added by somebody else to a group they are in already, or a dummy from being added', async () => {
        const group = await makeGroup(ana);
        const toBruno = await befriend(ana, bruno);
        const { id } = await addFriend(ana, group.id, toBruno.id);
        await seedClosedGroups(bruno.userId, MAX_CLOSED_GROUPS);

        await groupOf(await putMember(ana, group.id, id, { friend: toBruno.id }));
        await addDummy(ana, group.id, 'Dani');
    });

    it('does not stop a friend with closed groups of the adder', async () => {
        const group = await makeGroup(ana);
        const toBruno = await befriend(ana, bruno);
        await seedClosedGroups(ana.userId, MAX_CLOSED_GROUPS - 1);

        await addFriend(ana, group.id, toBruno.id);
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
