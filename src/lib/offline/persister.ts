import { CATEGORIES_KEY, EXPENSES_KEY } from '@/lib/api';

import type { KeyValueStorage } from './storage';
import type { PersistedClient, Persister, PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

const STORAGE_KEY = 'tarja:query-cache';

// Bump it when the shape of what the cache holds changes: the old copy is then thrown away
const PERSIST_BUSTER = '1';

function createPersister(storage: KeyValueStorage): Persister {
    return {
        persistClient: (client: PersistedClient) => storage.set(STORAGE_KEY, client),
        restoreClient: () => storage.get<PersistedClient>(STORAGE_KEY),
        removeClient: () => storage.remove(STORAGE_KEY),
    };
}

const PERSISTED_QUERIES: readonly unknown[] = [EXPENSES_KEY[0], CATEGORIES_KEY[0]];

// What survives a reload: the expenses, which are the local copy of the user's data, and the categories they are
// filed under. Everything else is cheap to refetch.
// A failed sync leaves the query in error with its data, and that data is still the copy to keep.
function createPersistOptions(storage: KeyValueStorage): Omit<PersistQueryClientOptions, 'queryClient'> {
    return {
        persister: createPersister(storage),
        maxAge: Infinity,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
            shouldDehydrateQuery: (query) =>
                PERSISTED_QUERIES.includes(query.queryKey[0]) && query.state.data !== undefined,
        },
    };
}

export { PERSIST_BUSTER, createPersistOptions, createPersister };
