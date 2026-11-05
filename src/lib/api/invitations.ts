import { toApiError } from './api-error';
import { api } from './client';

import type { FriendInvitation, InvitationView } from '@core/invitation';
import type { SharedGroup } from '@core/shared-group';

// The invitation of a friend, kept in memory only, as changing it needs a connection
const friendInvitationKey = (groupId: string) => ['friend-invitation', groupId] as const;

const fetchFriendInvitation = async (groupId: string): Promise<FriendInvitation | null> => {
    const response = await api.api.groups[':groupId'].invitations.$get({ param: { groupId } });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()).invitation;
};

// A new link for the dummy of the friend, in place of the open one
const postFriendInvitation = async (groupId: string): Promise<FriendInvitation> => {
    const response = await api.api.groups[':groupId'].invitations.$post({ param: { groupId } });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()).invitation;
};

// Revokes the open link, so sending it twice is harmless
const deleteFriendInvitation = async (groupId: string): Promise<FriendInvitation | null> => {
    const response = await api.api.groups[':groupId'].invitations.$delete({ param: { groupId } });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()).invitation;
};

// The calls of a link carry its token in the body, so that no URL the server logs holds it

const readInvitation = async (token: string): Promise<InvitationView> => {
    const response = await api.api.invitations.read.$post({ json: { token } });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

// The friend the person becomes, as the groups list it
const acceptInvitation = async (token: string): Promise<SharedGroup> => {
    const response = await api.api.invitations.accept.$post({ json: { token } });
    if (!response.ok) throw await toApiError(response);
    return response.json();
};

const declineInvitation = async (token: string): Promise<void> => {
    const response = await api.api.invitations.decline.$post({ json: { token } });
    if (!response.ok) throw await toApiError(response);
};

export {
    acceptInvitation,
    declineInvitation,
    deleteFriendInvitation,
    fetchFriendInvitation,
    friendInvitationKey,
    postFriendInvitation,
    readInvitation,
};
