import { useQueries, useQuery, type QueryObserverResult } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';

import { groupsQuery, type GroupEntriesState } from '@/lib/api';
import { RETRY_EVERY_MS, groupEntriesQuery, useGroupOutbox, type PendingEntry } from '@/lib/offline';
import { upsertById } from '@core/expense-merge';

import type { LedgerEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

const NO_GROUPS: SharedGroup[] = [];

// The groups and friends the person is in, closed and archived ones too, from the local copy
const useGroups = () => {
    const query = useQuery(groupsQuery());

    return {
        groups: query.data ?? NO_GROUPS,
        // Whether this device has ever heard from the server
        hasData: query.data !== undefined,
        isError: query.isError,
        // Waiting for the connection rather than loading
        isWaitingForNetwork: query.fetchStatus === 'paused',
    };
};

// The entries of one group as the person sees them
interface Ledger {
    group: SharedGroup;
    // What the server told this device, with the person's unsynced writes on top; deleted ones included, as they stay
    // until the server has heard of it
    entries: LedgerEntry[];
    hasData: boolean;
    isError: boolean;
    isWaitingForNetwork: boolean;
}

// What a ledger needs of each sync, kept by Query from one render to the next while it doesn't change
const syncStates = (results: QueryObserverResult<GroupEntriesState>[]) => {
    return results.map((result) => ({
        entries: result.data?.entries,
        isError: result.isError,
        isWaitingForNetwork: result.fetchStatus === 'paused',
    }));
};

// A write of the person waiting to be sent, as the ledger shows it: theirs, made by whoever made the version it replaces
const withPending = (entries: readonly LedgerEntry[], pending: readonly PendingEntry[], me: string): LedgerEntry[] => {
    return pending.reduce<LedgerEntry[]>(
        (list, write) => {
            const createdBy = list.find((entry) => entry.id === write.id)?.createdBy ?? me;
            return upsertById(list, { ...write, createdBy, updatedBy: me });
        },
        [...entries]
    );
};

// Every group with its entries, each synced by its own query: on open, focus, reconnect and after a write, and every
// 30 s while it has a write waiting
const useLedgers = () => {
    const outbox = useGroupOutbox();
    const { pending } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const { groups } = useGroups();
    const states = useQueries({
        queries: groups.map((group) => ({
            ...groupEntriesQuery(outbox, group.id),
            refetchInterval: pending.some((write) => write.groupId === group.id) ? RETRY_EVERY_MS : false,
        })),
        combine: syncStates,
    });

    const ledgers = useMemo(
        () =>
            groups.map((group, index): Ledger => {
                const { entries, isError, isWaitingForNetwork } = states[index]!;
                const mine = pending.filter((write) => write.groupId === group.id);
                return {
                    group,
                    entries: withPending(entries ?? [], mine, group.me),
                    hasData: entries !== undefined,
                    isError,
                    isWaitingForNetwork,
                };
            }),
        [groups, states, pending]
    );
    const pendingIds = useMemo(() => new Set(pending.map((write) => write.id)), [pending]);

    return { ledgers, pendingIds };
};

// One group with its entries, for a screen of that group alone: synced like each one of useLedgers, and undefined while
// the device doesn't hold the group
const useLedger = (groupId: string): Ledger | undefined => {
    const outbox = useGroupOutbox();
    const { pending } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const { groups } = useGroups();
    const group = groups.find((item) => item.id === groupId);
    const query = useQuery({
        ...groupEntriesQuery(outbox, groupId),
        enabled: group !== undefined,
        refetchInterval: pending.some((write) => write.groupId === groupId) ? RETRY_EVERY_MS : false,
    });
    const entries = query.data?.entries;
    const { isError } = query;
    const isWaitingForNetwork = query.fetchStatus === 'paused';

    return useMemo(() => {
        if (!group) return undefined;
        const mine = pending.filter((write) => write.groupId === group.id);
        return {
            group,
            entries: withPending(entries ?? [], mine, group.me),
            hasData: entries !== undefined,
            isError,
            isWaitingForNetwork,
        };
    }, [group, entries, pending, isError, isWaitingForNetwork]);
};

export { useGroups, useLedger, useLedgers, type Ledger };
