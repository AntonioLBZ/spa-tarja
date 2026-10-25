import { del, get, set } from 'idb-keyval';

interface KeyValueStorage {
    get: <T>(key: string) => Promise<T | undefined>;
    set: (key: string, value: unknown) => Promise<void>;
    remove: (key: string) => Promise<void>;
}

const idbStorage: KeyValueStorage = {
    get: <T>(key: string) => get<T>(key),
    set: (key, value) => set(key, value),
    remove: (key) => del(key),
};

export { idbStorage };
export type { KeyValueStorage };
