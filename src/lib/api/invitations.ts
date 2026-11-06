import { toApiError } from './api-error';
import { api } from './client';

import type { InvitationView, PendingInvitation } from '@core/invitation';
import type { SharedGroup } from '@core/shared-group';

// The person's own links to be friends that are still open, kept in memory only, as changing them needs a connection
const PENDING_INVITATIONS_KEY = ['pending-invitations'] as const;

const fetchPendingInvitations = async (): Promise<PendingInvitation[]> => {
    const response = await api.api.invitations.$get();
    if (!response.ok) throw await toApiError(response);
    return (await response.json()).invitations;
};

// A new link to be friends, with nobody behind it
const postInvitation = async (): Promise<PendingInvitation> => {
    const response = await api.api.invitations.$post();
    if (!response.ok) throw await toApiError(response);
    return (await response.json()).invitation;
};

// Revokes one by its id, which opens nothing without the signature, so sending it twice is harmless; answers the links
// still open
const deleteInvitation = async (invitationId: string): Promise<PendingInvitation[]> => {
    const response = await api.api.invitations[':invitationId'].$delete({ param: { invitationId } });
    if (!response.ok) throw await toApiError(response);
    return (await response.json()).invitations;
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
    PENDING_INVITATIONS_KEY,
    acceptInvitation,
    declineInvitation,
    deleteInvitation,
    fetchPendingInvitations,
    postInvitation,
    readInvitation,
};
