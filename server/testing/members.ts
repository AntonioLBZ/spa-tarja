import { expect } from 'vitest';

import { groupOf, send } from '@server/testing/groups';
import { type TestSession } from '@server/testing/session';

import type { SharedGroup } from '@core/groups/shared-group';

const putMember = (as: TestSession, groupId: string, memberId: string, body: unknown) => {
    return send(as, 'PUT', `/groups/${groupId}/members/${memberId}`, body);
};

const addDummy = async (as: TestSession, groupId: string, name: string) => {
    const id = crypto.randomUUID();
    return { id, group: await groupOf(await putMember(as, groupId, id, { name })) };
};

const addFriend = async (as: TestSession, groupId: string, friend: string, replaces?: string) => {
    const id = crypto.randomUUID();
    return { id, group: await groupOf(await putMember(as, groupId, id, { friend, replaces })) };
};

const member = (group: SharedGroup, id: string) => {
    return group.members.find((candidate) => candidate.id === id);
};

const removeMember = (as: TestSession, groupId: string, memberId: string) => {
    return send(as, 'DELETE', `/groups/${groupId}/members/${memberId}`);
};

const merge = (as: TestSession, groupId: string, memberId: string, into: string) => {
    return send(as, 'POST', `/groups/${groupId}/members/${memberId}/merge`, { into });
};

const error = async (response: Response, status: number) => {
    expect(response.status).toBe(status);
    return ((await response.json()) as { error: string }).error;
};

export { addDummy, addFriend, error, member, merge, putMember, removeMember };
