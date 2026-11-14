import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { groupEntriesKey, groupsQuery, type GroupEntriesState } from '@/lib/api';

import { groupEntriesQuery } from './group-sync';
import { useGroupOutbox } from './outbox-context';

// How often the groups are asked for while the page is in sight, so a window left open hears what others add (ADR-0025)
const WATCH_EVERY_MS = 60_000;

// Asks for the groups once a minute while the page is visible (Query asks nothing in the background) and pulls every
// open group whose cursor moved past the one the device holds, whatever screen is showing
const useGroupWatcher = () => {
    const client = useQueryClient();
    const outbox = useGroupOutbox();
    const { data: groups } = useQuery({ ...groupsQuery(), refetchInterval: WATCH_EVERY_MS });

    useEffect(() => {
        for (const group of groups ?? []) {
            if (group.closed !== null) continue;
            const cursor = client.getQueryData<GroupEntriesState>(groupEntriesKey(group.id))?.cursor ?? 0;
            if (group.seq > cursor) void client.prefetchQuery({ ...groupEntriesQuery(outbox, group.id), staleTime: 0 });
        }
    }, [groups, client, outbox]);
};

export { WATCH_EVERY_MS, useGroupWatcher };
