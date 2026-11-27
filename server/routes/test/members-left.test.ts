import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    MAX_CLOSED_GROUPS,
    MAX_GROUP_MEMBERS,
    MAX_GROUP_MEMBER_ROWS,
    MAX_OPEN_GROUPS,
} from '@core/groups/shared-group';
import {
    befriend,
    groupOf,
    listGroups,
    makeGroup,
    memberNamed,
    racingEnv,
    seedClosedGroups,
    send,
} from '@server/testing/groups';
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
            name: 'Bruno',
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
        await groupOf(await send(bruno, 'PUT', `/groups/${group.id}/me`, { showInExpenses: false, pinned: true }));
        await groupOf(await removeMember(bruno, group.id, id));
        await groupOf(await send(bruno, 'PUT', `/groups/${group.id}/me`, { archived: true }));
        const left = await rowOf(id);

        await groupOf(await comeBack(ana, group.id, friend.id));

        const theirs = (await listGroups(bruno)).find((candidate) => candidate.id === group.id);
        expect(theirs).toMatchObject({ closed: null, archived: false, showInExpenses: false, pinnedAt: null, me: id });
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
