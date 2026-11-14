import { forgetPushSuggestion } from '@/lib/push';

import { GROUP_OUTBOX_STORAGE_KEY, OUTBOX_STORAGE_KEY } from './outbox';
import { QUERY_CACHE_STORAGE_KEY } from './persister';
import { forgetSharedWith } from './shared-with';

import type { KeyValueStorage } from './storage';

interface UserStorage {
    storage: KeyValueStorage;
    // Deletes the outboxes, the cache, the group last shared with and the answer to the suggestion of notifications of
    // the user from this device. Writes that come
    // after, such as a throttled save of the cache, are ignored so they can't bring the data back.
    discard: () => Promise<void>;
}

// The user's own corner of a storage: what one account keeps on a device is never seen or pushed by another
const createUserStorage = (storage: KeyValueStorage, userId: string): UserStorage => {
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
            forgetSharedWith(userId);
            forgetPushSuggestion(userId);
            const keys = [OUTBOX_STORAGE_KEY, GROUP_OUTBOX_STORAGE_KEY, QUERY_CACHE_STORAGE_KEY];
            await Promise.all(keys.map((key) => storage.remove(scoped(key))));
        },
    };
};

export { createUserStorage, type UserStorage };
