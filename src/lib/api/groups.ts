import { toApiError } from './api-error';
import { api } from './client';

import type { GroupChange, MemberWrite, MySwitches, NewGroup, SharedGroup } from '@core/shared-group';

const GROUPS_KEY = ['groups'] as const;

// Every write below answers the group as it is afterwards, and a write whose effect is there already answers it as it
// is, so sending one twice is harmless. A refusal carries its reason in `code`.

const fetchGroups = async (): Promise<SharedGroup[]> => {
    const response = await api.api.groups.$get();
    if (!response.ok) throw await toApiError(response);
    return (await response.json()).groups;
};

// Makes the group when it isn't there; otherwise changes its name or its simplified debts
const putGroup = async (groupId: string, input: NewGroup | GroupChange): Promise<SharedGroup> => {
    const response = await api.api.groups[':groupId'].$put({ param: { groupId }, json: input });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

const deleteGroup = async (groupId: string): Promise<SharedGroup> => {
    const response = await api.api.groups[':groupId'].$delete({ param: { groupId } });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

// Adds a dummy or renames a member by name, or adds a friend, as a new member or in place of a dummy
const putMember = async (groupId: string, memberId: string, input: MemberWrite): Promise<SharedGroup> => {
    const response = await api.api.groups[':groupId'].members[':memberId'].$put({
        param: { groupId, memberId },
        json: input,
    });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

// Leaving, for the caller's own member; removing, for anybody else's
const deleteMember = async (groupId: string, memberId: string): Promise<SharedGroup> => {
    const response = await api.api.groups[':groupId'].members[':memberId'].$delete({ param: { groupId, memberId } });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

const mergeMember = async (groupId: string, memberId: string, into: string): Promise<SharedGroup> => {
    const response = await api.api.groups[':groupId'].members[':memberId'].merge.$post({
        param: { groupId, memberId },
        json: { into },
    });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

const handOver = async (groupId: string, memberId: string): Promise<SharedGroup> => {
    const response = await api.api.groups[':groupId'].owner.$post({ param: { groupId }, json: { memberId } });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

// The caller's own switches, which a closed group takes too
const putMySwitches = async (groupId: string, input: MySwitches): Promise<SharedGroup> => {
    const response = await api.api.groups[':groupId'].me.$put({ param: { groupId }, json: input });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

export {
    GROUPS_KEY,
    deleteGroup,
    deleteMember,
    fetchGroups,
    handOver,
    mergeMember,
    putGroup,
    putMember,
    putMySwitches,
};
