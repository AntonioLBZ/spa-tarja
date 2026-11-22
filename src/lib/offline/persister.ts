import { BUDGETS_KEY, CATEGORIES_KEY, EXPENSES_KEY, GROUPS_KEY, GROUP_ENTRIES_KEY, INCOME_KEY } from '@/lib/api';

import type { KeyValueStorage } from './storage';
import type { PersistedClient, Persister, PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

const QUERY_CACHE_STORAGE_KEY = 'tarja:query-cache';

// Bump it when the shape of what the cache holds changes: the old copy is then thrown away
const PERSIST_BUSTER = '1';

// The cache is written at most once in this time. Each write copies all of it, megabytes for a big account, while the page
// waits, and a sync changes it many times in a row; the copy is the latest state, so the ones in between are not missed.
const PERSIST_EVERY_MS = 1000;

// A persister that can be told to write what is waiting now, as the page is hidden or the user's data is unmounted
type ThrottledPersister = Persister & { flush: () => Promise<void> };

const createPersister = (storage: KeyValueStorage, every = PERSIST_EVERY_MS): ThrottledPersister => {
    let latest: PersistedClient | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastWrite = -Infinity;

    const write = async () => {
        timer = null;
        lastWrite = Date.now();
        const client = latest;
        latest = null;
        if (client) await storage.set(QUERY_CACHE_STORAGE_KEY, client);
    };

    return {
        // The first change is written at once; those that follow within the time are written together at its end
        persistClient: (client: PersistedClient) => {
            latest = client;
            if (timer !== null) return;
            const wait = lastWrite + every - Date.now();
            if (wait <= 0) return write();
            timer = setTimeout(() => void write().catch(() => undefined), wait);
        },
        restoreClient: () => storage.get<PersistedClient>(QUERY_CACHE_STORAGE_KEY),
        flush: async () => {
            if (timer === null) return;
            clearTimeout(timer);
            await write();
        },
        removeClient: () => {
            if (timer !== null) clearTimeout(timer);
            timer = null;
            latest = null;
            return storage.remove(QUERY_CACHE_STORAGE_KEY);
        },
    };
};

const PERSISTED_QUERIES: readonly unknown[] = [
    EXPENSES_KEY[0],
    CATEGORIES_KEY[0],
    INCOME_KEY[0],
    BUDGETS_KEY[0],
    GROUPS_KEY[0],
    GROUP_ENTRIES_KEY,
];

// What survives a reload: the expenses, which are the local copy of the user's data, the categories they are filed under,
// the income and the limits of each month, and the groups with the entries of each. Everything else is cheap to refetch.
// A failed sync leaves the query in error with its data, and that data is still the copy to keep.
const createPersistOptions = (
    storage: KeyValueStorage
): Omit<PersistQueryClientOptions, 'queryClient'> & { persister: ThrottledPersister } => {
    return {
        persister: createPersister(storage),
        maxAge: Infinity,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
            shouldDehydrateQuery: (query) =>
                PERSISTED_QUERIES.includes(query.queryKey[0]) && query.state.data !== undefined,
        },
    };
};

export {
    PERSIST_BUSTER,
    PERSIST_EVERY_MS,
    QUERY_CACHE_STORAGE_KEY,
    createPersistOptions,
    createPersister,
    type ThrottledPersister,
};
