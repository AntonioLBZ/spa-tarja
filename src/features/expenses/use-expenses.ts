import { useQuery } from '@tanstack/react-query';
import { useMemo, useSyncExternalStore } from 'react';

import { expensesQuery, useOutbox } from '@/lib/offline';
import { applyPending } from '@core/expense-merge';

// How often to retry while something is waiting to sync, for connections that say they're up but aren't
const RETRY_EVERY_MS = 30_000;

// The expenses as the person sees them: what the server told this device, with their unsynced changes on top
function useExpenses() {
    const outbox = useOutbox();
    const { pending } = useSyncExternalStore(outbox.subscribe, outbox.getState);
    const query = useQuery({ ...expensesQuery(outbox), refetchInterval: pending.length > 0 ? RETRY_EVERY_MS : false });

    const server = query.data?.expenses;
    const expenses = useMemo(() => applyPending(server ?? [], pending), [server, pending]);
    const pendingIds = useMemo(() => new Set(pending.map((expense) => expense.id)), [pending]);

    return {
        // Deleted ones included: they stay until the server has heard of it
        expenses,
        pendingIds,
        // Whether this device has ever heard from the server
        hasData: query.data !== undefined,
        isError: query.isError,
        // Waiting for the connection rather than loading
        isWaitingForNetwork: query.fetchStatus === 'paused',
    };
}

export { useExpenses };
