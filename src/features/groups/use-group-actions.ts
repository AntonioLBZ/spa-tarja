import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
    GROUPS_KEY,
    PENDING_INVITATIONS_KEY,
    acceptInvitation,
    declineInvitation,
    deleteFriendInvitation,
    deleteGroup,
    deleteInvitation,
    deleteMember,
    friendInvitationKey,
    groupEntriesKey,
    handOver,
    mergeMember,
    postFriendInvitation,
    postInvitation,
    putGroup,
    putMember,
    putMySwitches,
} from '@/lib/api';
import { syncGroup, useGroupOutbox } from '@/lib/offline';
import { upsertById } from '@core/expense-merge';
import { DEFAULT_CURRENCY } from '@core/money';

import { LocalRefusal } from './local-refusal';

import type { FriendInvitation, PendingInvitation } from '@core/invitation';
import type { GroupChange, MySwitches, SharedGroup } from '@core/shared-group';

// A member made by name, with an id made on the device
interface Placeholder {
    id: string;
    name: string;
}

// The ids come from the screen, which keeps them while it is open, so sending a make again after a lost answer is
// harmless: the server answers the group it already made
interface NewGroupInput {
    id: string;
    name: string;
    // The person's own member
    me: string;
    others: readonly Placeholder[];
}

interface NewFriendInput {
    id: string;
    me: string;
    other: Placeholder;
}

// One of the person's friends who is a real person, by the id of that friend, as a new member or in place of a dummy
interface FriendInput {
    friend: string;
    replaces?: string;
}

// Whatever shapes a group needs a connection (ADR-0013), and an open group, but for the person's own switches. Each call
// waits for the server and then puts the group it answers in the cache, so the list never needs a refetch.
const useGroupActions = () => {
    const queryClient = useQueryClient();
    const outbox = useGroupOutbox();

    return useMemo(() => {
        const online = () => {
            if (!onlineManager.isOnline()) throw new LocalRefusal('offline');
        };

        const groupOf = (groupId: string) => {
            return queryClient.getQueryData<SharedGroup[]>(GROUPS_KEY)?.find((item) => item.id === groupId);
        };

        const openGroup = (groupId: string): SharedGroup => {
            online();
            const group = groupOf(groupId);
            if (!group || group.closed !== null) throw new LocalRefusal('read-only');
            return group;
        };

        // A read of the groups on its way started before this answer, so it would put an older list over it
        const keep = async (group: SharedGroup): Promise<SharedGroup> => {
            await queryClient.cancelQueries({ queryKey: GROUPS_KEY });
            queryClient.setQueryData<SharedGroup[]>(GROUPS_KEY, (groups = []) => upsertById(groups, group));
            return group;
        };

        const keepInvitation = (groupId: string, invitation: FriendInvitation | null) => {
            queryClient.setQueryData(friendInvitationKey(groupId), invitation);
            return invitation;
        };

        // A read of the links on its way would put an older list over the one this change leaves. A list never read is
        // read again behind it, as the change alone would leave out the links already there.
        const keepLinks = async (change: (links: PendingInvitation[]) => PendingInvitation[]) => {
            await queryClient.cancelQueries({ queryKey: PENDING_INVITATIONS_KEY });
            const read = queryClient.getQueryData<PendingInvitation[]>(PENDING_INVITATIONS_KEY) !== undefined;
            queryClient.setQueryData<PendingInvitation[]>(PENDING_INVITATIONS_KEY, (links = []) => change(links));
            if (!read) void queryClient.invalidateQueries({ queryKey: PENDING_INVITATIONS_KEY });
        };

        return {
            async createGroup({ id, name, me, others }: NewGroupInput) {
                online();
                return keep(
                    await putGroup(id, {
                        kind: 'group',
                        name,
                        currency: DEFAULT_CURRENCY,
                        me: { id: me },
                        others: [...others],
                    })
                );
            },
            async createFriend({ id, me, other }: NewFriendInput) {
                online();
                return keep(
                    await putGroup(id, {
                        kind: 'direct',
                        name: null,
                        currency: DEFAULT_CURRENCY,
                        me: { id: me },
                        others: [other],
                    })
                );
            },
            // The name or the simplified debts, for the owner
            async change(groupId: string, change: GroupChange) {
                openGroup(groupId);
                return keep(await putGroup(groupId, change));
            },
            // Adds a dummy by name, or renames a member
            async savePerson(groupId: string, memberId: string, name: string) {
                openGroup(groupId);
                return keep(await putMember(groupId, memberId, { name }));
            },
            async addFriend(groupId: string, memberId: string, input: FriendInput) {
                openGroup(groupId);
                return keep(await putMember(groupId, memberId, input));
            },
            async removeMember(groupId: string, memberId: string) {
                openGroup(groupId);
                return keep(await deleteMember(groupId, memberId));
            },
            async merge(groupId: string, memberId: string, into: string) {
                openGroup(groupId);
                return keep(await mergeMember(groupId, memberId, into));
            },
            async handOver(groupId: string, memberId: string) {
                openGroup(groupId);
                return keep(await handOver(groupId, memberId));
            },
            async remove(groupId: string) {
                openGroup(groupId);
                return keep(await deleteGroup(groupId));
            },
            // Someone who left reads the group only as it was then, so what this device hasn't sent or pulled by then
            // would never reach them: both go first, and a failure of either stops the leave
            async leave(groupId: string) {
                const { me } = openGroup(groupId);
                const failure = await syncGroup(queryClient, outbox, groupId).then(
                    (state) => {
                        queryClient.setQueryData(groupEntriesKey(groupId), state);
                        return null;
                    },
                    (error: unknown) => ({ cause: error })
                );
                // Sending the writes can find the group closed meanwhile
                if (groupOf(groupId)?.closed !== null) throw new LocalRefusal('read-only', failure ?? undefined);
                if (failure || outbox.getState().pending.some((write) => write.groupId === groupId)) {
                    throw new LocalRefusal('unsynced', failure ?? undefined);
                }
                return keep(await deleteMember(groupId, me));
            },
            // Show in my expenses and Archive, which a closed group takes too
            async setSwitches(groupId: string, switches: MySwitches) {
                online();
                return keep(await putMySwitches(groupId, switches));
            },
            // A new link for the dummy of a friend, in place of the open one
            async invite(groupId: string) {
                openGroup(groupId);
                return keepInvitation(groupId, await postFriendInvitation(groupId));
            },
            async revokeInvitation(groupId: string) {
                openGroup(groupId);
                return keepInvitation(groupId, await deleteFriendInvitation(groupId));
            },
            // A new link to be friends, with nobody behind it, first in the list of the person's links
            async inviteFriend() {
                online();
                const made = await postInvitation();
                await keepLinks((links) => [made, ...links.filter((link) => link.id !== made.id)]);
                return made;
            },
            async revokeLink(invitationId: string) {
                online();
                const links = await deleteInvitation(invitationId);
                await keepLinks(() => links);
                return links;
            },
            // The person takes the place of the dummy the link is for, and the friend is theirs like any other. The
            // groups may never have been read on this device, so they are read again behind it.
            async acceptLink(token: string) {
                online();
                const friend = await keep(await acceptInvitation(token));
                void queryClient.invalidateQueries({ queryKey: GROUPS_KEY });
                return friend;
            },
            async declineLink(token: string) {
                online();
                await declineInvitation(token);
            },
        };
    }, [queryClient, outbox]);
};

export { useGroupActions, type FriendInput, type NewFriendInput, type NewGroupInput, type Placeholder };
