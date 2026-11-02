import { upsertById } from '@core/expense-merge';

import type { KeyValueStorage } from './storage';
import type { SharedEntry } from '@core/shared-entry';

// Where each outbox is stored; the entries of groups have their own, so the stored format of the first never changes
const OUTBOX_STORAGE_KEY = 'tarja:outbox';
const GROUP_OUTBOX_STORAGE_KEY = 'tarja:group-outbox';

// What an outbox can hold: a write the server applies by id, the later `updatedAt` winning
interface OutboxItem {
    id: string;
    updatedAt: number;
}

// An entry of a group as it waits to be sent
type PendingEntry = SharedEntry & { groupId: string };

// A write the server refused for good, and the reason it gave, when it gave one
interface Rejection<T> {
    item: T;
    code: string | null;
}

interface OutboxState<T> {
    // The latest version of each write the server hasn't confirmed, in the order they were first saved
    pending: readonly T[];
    // Writes the server refused for good since the user last dismissed the notice
    rejected: readonly Rejection<T>[];
}

interface Outbox<T extends OutboxItem> {
    ready: Promise<void>;
    getState: () => OutboxState<T>;
    subscribe: (listener: () => void) => () => void;
    put: (item: T) => Promise<void>;
    // Several at once, written to the device together: either all of them are safe or none is
    putAll: (items: readonly T[]) => Promise<void>;
    // Forget a write the server confirmed, unless it was edited again meanwhile
    settle: (sent: T) => Promise<void>;
    // Forget a write the server refused for good, unless it was edited again meanwhile, and keep why
    reject: (sent: T, code: string | null) => Promise<void>;
    dismissRejected: () => void;
}

const createOutbox = <T extends OutboxItem>(storage: KeyValueStorage, key: string): Outbox<T> => {
    let state: OutboxState<T> = { pending: [], rejected: [] };
    const listeners = new Set<() => void>();
    let queue: Promise<unknown> = Promise.resolve();

    const commit = (next: OutboxState<T>) => {
        state = next;
        listeners.forEach((listener) => listener());
    };

    // One operation at a time, each on top of the previous result; a failure doesn't block the next ones
    const run = <R>(task: () => Promise<R>): Promise<R> => {
        const result = queue.then(task);
        queue = result.catch(() => undefined);
        return result;
    };

    // The new state is on disk before anyone sees it, so what's on screen is never lost on a crash
    const save = async (next: OutboxState<T>) => {
        await storage.set(key, next.pending);
        commit(next);
    };

    const forget = (sent: T, rejection: Rejection<T> | null) => {
        return run(async () => {
            const stored = state.pending.find((item) => item.id === sent.id);
            if (stored?.updatedAt !== sent.updatedAt) return;
            await save({
                pending: state.pending.filter((item) => item.id !== sent.id),
                rejected: rejection ? [...state.rejected, rejection] : state.rejected,
            });
        });
    };

    // A failed read leaves the outbox empty; writing still works
    const ready = run(async () => {
        const stored = await storage.get<T[]>(key);
        if (stored?.length) commit({ ...state, pending: stored });
    }).catch(() => undefined);

    return {
        ready,
        getState: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        put: (item) => run(() => save({ ...state, pending: upsertById(state.pending, item) })),
        putAll: (items) =>
            items.length === 0
                ? Promise.resolve()
                : run(() => save({ ...state, pending: items.reduce<T[]>(upsertById, [...state.pending]) })),
        settle: (sent) => forget(sent, null),
        reject: (sent, code) => forget(sent, { item: sent, code }),
        dismissRejected: () => commit({ ...state, rejected: [] }),
    };
};

export {
    GROUP_OUTBOX_STORAGE_KEY,
    OUTBOX_STORAGE_KEY,
    createOutbox,
    type Outbox,
    type OutboxItem,
    type OutboxState,
    type PendingEntry,
    type Rejection,
};
