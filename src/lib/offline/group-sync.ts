import { queryOptions, type QueryClient } from '@tanstack/react-query';

import { ApiError, GROUPS_KEY, fetchEntryChanges, groupEntriesKey, putEntry, type GroupEntriesState } from '@/lib/api';
import { upsertById } from '@core/expense-merge';

import { inTurn, pushPending } from './sync';

import type { Outbox, PendingEntry } from './outbox';
import type { SharedGroup } from '@core/shared-group';

// What a group says no to for good about an entry (ADR-0013): the group is gone or closed, the caller isn't in it, or
// the entry can't be what it says
const PERMANENT = [400, 403, 404, 409, 422];

// A group that refused a write as closed is read-only from then on. The answer doesn't say whether it was deleted or the
// person left, so it reads as deleted until the server is asked.
const markClosed = (client: QueryClient, groupId: string) => {
    client.setQueryData<SharedGroup[]>(GROUPS_KEY, (groups) =>
        groups?.map((group) =>
            group.id === groupId && group.closed === null ? { ...group, closed: 'deleted' } : group
        )
    );
};

const pushGroup = async (client: QueryClient, outbox: Outbox<PendingEntry>, groupId: string): Promise<void> => {
    await outbox.ready;
    const pending = outbox.getState().pending.filter((item) => item.groupId === groupId);
    let closed = false;
    try {
        await pushPending(outbox, pending, PERMANENT, async (entry) => {
            const kept = await putEntry(entry).catch((error: unknown) => {
                // Read-only at once, whatever happens to the rest of the push
                if (error instanceof ApiError && error.code === 'closed') {
                    markClosed(client, groupId);
                    closed = true;
                }
                throw error;
            });
            // The entry the server kept goes into the cache before the outbox lets go of it, so it never blinks out
            client.setQueryData<GroupEntriesState>(groupEntriesKey(groupId), (state) =>
                state ? { ...state, entries: upsertById(state.entries, kept) } : state
            );
        });
    } finally {
        if (closed) await client.invalidateQueries({ queryKey: GROUPS_KEY });
    }
};

const pullGroup = async (client: QueryClient, groupId: string): Promise<GroupEntriesState> => {
    const known = client.getQueryData<GroupEntriesState>(groupEntriesKey(groupId)) ?? { entries: [], cursor: 0 };
    const byId = new Map(known.entries.map((entry) => [entry.id, entry]));
    let cursor = known.cursor;

    for (;;) {
        const page = await fetchEntryChanges(groupId, cursor);
        for (const entry of page.entries) byId.set(entry.id, entry);
        cursor = page.cursor;
        if (!page.hasMore) return { entries: [...byId.values()], cursor };
    }
};

// Pushes the group's own pending entries, then pulls what changed after its cursor, after any sync of the group running
const syncGroup = (client: QueryClient, outbox: Outbox<PendingEntry>, groupId: string): Promise<GroupEntriesState> => {
    return inTurn(outbox, groupId, async () => {
        await pushGroup(client, outbox, groupId);
        return pullGroup(client, groupId);
    });
};

// The sync of one group, run by every trigger Query has, like the one of the expenses
const groupEntriesQuery = (outbox: Outbox<PendingEntry>, groupId: string) => {
    return queryOptions({
        queryKey: groupEntriesKey(groupId),
        queryFn: ({ client }) => syncGroup(client, outbox, groupId),
        gcTime: Infinity,
    });
};

export { groupEntriesQuery, syncGroup };
