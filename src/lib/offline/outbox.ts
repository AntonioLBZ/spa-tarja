import { upsertById } from '@core/expense-merge';

import type { KeyValueStorage } from './storage';
import type { Expense } from '@core/expense';

const OUTBOX_STORAGE_KEY = 'tarja:outbox';

interface OutboxState {
    // The latest version of each expense the server hasn't confirmed, in the order they were first saved
    pending: readonly Expense[];
    // Expenses the server refused for good since the user last dismissed the notice
    rejected: number;
}

interface Outbox {
    ready: Promise<void>;
    getState: () => OutboxState;
    subscribe: (listener: () => void) => () => void;
    put: (expense: Expense) => Promise<void>;
    // Forget an expense the server confirmed, unless it was edited again meanwhile
    settle: (sent: Expense) => Promise<void>;
    // Forget an expense the server refused for good, and count it
    reject: (sent: Expense) => Promise<void>;
    dismissRejected: () => void;
}

function createOutbox(storage: KeyValueStorage): Outbox {
    let state: OutboxState = { pending: [], rejected: 0 };
    const listeners = new Set<() => void>();
    let queue: Promise<unknown> = Promise.resolve();

    function commit(next: OutboxState) {
        state = next;
        listeners.forEach((listener) => listener());
    }

    // One operation at a time, each on top of the previous result; a failure doesn't block the next ones
    function run<T>(task: () => Promise<T>): Promise<T> {
        const result = queue.then(task);
        queue = result.catch(() => undefined);
        return result;
    }

    // The new state is on disk before anyone sees it, so what's on screen is never lost on a crash
    async function save(next: OutboxState) {
        await storage.set(OUTBOX_STORAGE_KEY, next.pending);
        commit(next);
    }

    function forget(sent: Expense, rejected: boolean) {
        return run(async () => {
            const stored = state.pending.find((item) => item.id === sent.id);
            if (stored?.updatedAt !== sent.updatedAt) return;
            await save({
                pending: state.pending.filter((item) => item.id !== sent.id),
                rejected: state.rejected + (rejected ? 1 : 0),
            });
        });
    }

    // A failed read leaves the outbox empty; writing still works
    const ready = run(async () => {
        const stored = await storage.get<Expense[]>(OUTBOX_STORAGE_KEY);
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
        put: (expense) => run(() => save({ ...state, pending: upsertById(state.pending, expense) })),
        settle: (sent) => forget(sent, false),
        reject: (sent) => forget(sent, true),
        dismissRejected: () => commit({ ...state, rejected: 0 }),
    };
}

export { OUTBOX_STORAGE_KEY, createOutbox };
export type { Outbox, OutboxState };
