import type { KeyValueStorage } from '@/lib/offline/storage';

// Survives a "reload" in a test the way IndexedDB does: hand the same instance to a new outbox
function createMemoryStorage(): KeyValueStorage {
    const values = new Map<string, unknown>();
    return {
        get: async <T>(key: string) => values.get(key) as T | undefined,
        set: async (key, value) => {
            values.set(key, structuredClone(value));
        },
        remove: async (key) => {
            values.delete(key);
        },
    };
}

export { createMemoryStorage };
