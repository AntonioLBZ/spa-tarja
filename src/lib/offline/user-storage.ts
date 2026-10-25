import { OUTBOX_STORAGE_KEY } from './outbox';
import { QUERY_CACHE_STORAGE_KEY } from './persister';

import type { KeyValueStorage } from './storage';

interface UserStorage {
    storage: KeyValueStorage;
    // Deletes the outbox and the cache of the user from this device. Writes that come after, such as a throttled
    // save of the cache, are ignored so they can't bring the data back.
    discard: () => Promise<void>;
}

// The user's own corner of a storage: what one account keeps on a device is never seen or pushed by another
function createUserStorage(storage: KeyValueStorage, userId: string): UserStorage {
    let discarded = false;
    const scoped = (key: string) => `${key}:${userId}`;

    return {
        storage: {
            get: (key) => storage.get(scoped(key)),
            set: async (key, value) => {
                if (!discarded) await storage.set(scoped(key), value);
            },
            remove: (key) => storage.remove(scoped(key)),
        },
        discard: async () => {
            discarded = true;
            await Promise.all([OUTBOX_STORAGE_KEY, QUERY_CACHE_STORAGE_KEY].map((key) => storage.remove(scoped(key))));
        },
    };
}

export { createUserStorage };
export type { UserStorage };
