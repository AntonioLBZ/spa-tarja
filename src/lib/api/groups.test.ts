import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { sampleGroup } from '@/lib/test/groups';
import { stubApi } from '@/lib/test/render-app';

import { ApiError } from './api-error';
import {
    deleteGroup,
    deleteMember,
    fetchGroups,
    handOver,
    mergeMember,
    putGroup,
    putMember,
    putMySwitches,
} from './groups';

import type { SharedGroup } from '@core/shared-group';

function open(groups: SharedGroup[] = []) {
    const api = createFakeApi({ groups });
    stubApi(api.handler);
    return api;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('fetchGroups', () => {
    it('reads every group and friend the person is in, closed ones too', async () => {
        const groups = [sampleGroup(), sampleGroup({ kind: 'direct', name: null, closed: 'deleted' })];
        open(groups);

        expect(await fetchGroups()).toEqual(groups);
    });

    it('throws an ApiError with the status when the server refuses', async () => {
        const api = open();
        api.state.unauthorized = true;

        await expect(fetchGroups()).rejects.toMatchObject({ status: 401 });
        await expect(fetchGroups()).rejects.toBeInstanceOf(ApiError);
    });
});

describe('putGroup', () => {
    it('makes a group with the ids sent, the maker named by the server, and answers it', async () => {
        open();
        const [id, me, other] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

        const group = await putGroup(id, {
            kind: 'group',
            name: 'Lisbon',
            currency: 'EUR',
            me: { id: me },
            others: [{ id: other, name: 'Bea' }],
        });

        expect(group).toMatchObject({ id, name: 'Lisbon', me, closed: null });
        expect(group.members.map((member) => [member.id, member.name, member.role])).toEqual([
            [me, TEST_USER.name, 'owner'],
            [other, 'Bea', 'member'],
        ]);
    });

    it('changes the name of a group that is there', async () => {
        const group = sampleGroup();
        open([group]);

        expect(await putGroup(group.id, { name: 'Porto' })).toMatchObject({ id: group.id, name: 'Porto' });
    });

    it('throws the reason the server gives', async () => {
        const api = open();
        api.state.groupRefusal = { status: 409, error: 'too-many-groups' };

        const made = putGroup(crypto.randomUUID(), {
            kind: 'direct',
            name: null,
            currency: 'EUR',
            me: { id: crypto.randomUUID() },
            others: [{ id: crypto.randomUUID(), name: 'Bea' }],
        });

        await expect(made).rejects.toMatchObject({ status: 409, code: 'too-many-groups' });
    });
});

describe('the people and the switches', () => {
    it('adds a dummy, renames it, merges it, hands the group over and leaves, each answering the group', async () => {
        const group = sampleGroup();
        const bea = group.members[1]!.id;
        const api = open([group]);
        const dummy = crypto.randomUUID();

        expect((await putMember(group.id, dummy, { name: 'Cris' })).members.at(-1)).toMatchObject({ name: 'Cris' });
        expect((await putMember(group.id, dummy, { name: 'Cristina' })).members.at(-1)).toMatchObject({
            name: 'Cristina',
        });
        expect((await mergeMember(group.id, dummy, bea)).members.at(-1)).toMatchObject({ mergedInto: bea });
        expect((await handOver(group.id, bea)).members[1]).toMatchObject({ role: 'owner' });
        expect(await deleteMember(group.id, group.me)).toMatchObject({ closed: 'left' });
        expect(api.groupRequests).toEqual([
            `PUT /api/groups/${group.id}/members/${dummy}`,
            `PUT /api/groups/${group.id}/members/${dummy}`,
            `POST /api/groups/${group.id}/members/${dummy}/merge`,
            `POST /api/groups/${group.id}/owner`,
            `DELETE /api/groups/${group.id}/members/${group.me}`,
        ]);
    });

    it('deletes a group, which answers it closed, and archives it', async () => {
        const group = sampleGroup();
        open([group]);

        expect(await deleteGroup(group.id)).toMatchObject({ closed: 'deleted' });
        expect(await putMySwitches(group.id, { archived: true, showInExpenses: false })).toMatchObject({
            archived: true,
            showInExpenses: false,
        });
    });

    it('throws the reason the server gives', async () => {
        const group = sampleGroup();
        const api = open([group]);
        api.state.groupRefusal = { status: 409, error: 'unsettled' };

        await expect(deleteMember(group.id, group.me)).rejects.toMatchObject({ status: 409, code: 'unsettled' });
    });
});
