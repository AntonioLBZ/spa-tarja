import { queryOptions, type QueryClient } from '@tanstack/react-query';

import { ApiError, EXPENSES_KEY, fetchChanges, putExpense, type ExpensesState } from '@/lib/api';
import { upsertById } from '@core/expense-merge';

import type { Outbox, OutboxItem } from './outbox';
import type { Expense } from '@core/expense';

// How often to retry while something is waiting to sync, for connections that say they're up but aren't
const RETRY_EVERY_MS = 30_000;

// What the server says no to for good about an expense: the same write will never be accepted, so retrying is pointless
const PERMANENT = [400, 409, 422];

// Sends what is pending, oldest first. What the server refused for good leaves the outbox with its reason; the first
// failure that may pass on its own stops the run, keeping the order. A paused outbox sends nothing.
const pushPending = async <T extends OutboxItem>(
    outbox: Outbox<T>,
    items: readonly T[],
    permanent: readonly number[],
    send: (item: T) => Promise<void>
): Promise<void> => {
    for (const item of items) {
        if (outbox.isPaused()) return;
        try {
            await send(item);
            await outbox.settle(item);
        } catch (error) {
            if (!(error instanceof ApiError && permanent.includes(error.status))) throw error;
            await outbox.reject(item, error.code);
        }
    }
};

// The syncs running, by outbox and by what they sync, so overlapping triggers never send the same write twice
const running = new WeakMap<object, Map<string, Promise<unknown>>>();

// Runs the sync after the one of the same scope that is running, if any, whether that one fails or not
const inTurn = <R>(outbox: object, scope: string, task: () => Promise<R>): Promise<R> => {
    const scopes = running.get(outbox) ?? new Map<string, Promise<unknown>>();
    running.set(outbox, scopes);
    const turn = (scopes.get(scope) ?? Promise.resolve()).catch(() => undefined).then(task);
    scopes.set(scope, turn);
    return turn;
};

const pushOutbox = async (client: QueryClient, outbox: Outbox<Expense>): Promise<void> => {
    await outbox.ready;
    await pushPending(outbox, outbox.getState().pending, PERMANENT, async (expense) => {
        const kept = await putExpense(expense);
        // The row the server kept goes into the cache before the outbox lets go of it, so it never blinks out, also on a
        // device that never pulled, whose pull then starts from the beginning
        client.setQueryData<ExpensesState>(EXPENSES_KEY, (state) =>
            state ? { ...state, expenses: upsertById(state.expenses, kept) } : { expenses: [kept], cursor: 0 }
        );
    });
};

const pullChanges = async (client: QueryClient): Promise<ExpensesState> => {
    const known = client.getQueryData<ExpensesState>(EXPENSES_KEY) ?? { expenses: [], cursor: 0 };
    const byId = new Map(known.expenses.map((expense) => [expense.id, expense]));
    let cursor = known.cursor;

    for (;;) {
        const page = await fetchChanges(cursor);
        for (const expense of page.expenses) byId.set(expense.id, expense);
        cursor = page.cursor;
        if (!page.hasMore) return { expenses: [...byId.values()], cursor };
    }
};

const syncExpenses = (client: QueryClient, outbox: Outbox<Expense>): Promise<ExpensesState> => {
    return inTurn(outbox, 'expenses', async () => {
        await pushOutbox(client, outbox);
        return pullChanges(client);
    });
};

// The one place data moves: any trigger Query has (open, focus, reconnect, invalidation) runs a full sync
const expensesQuery = (outbox: Outbox<Expense>) => {
    return queryOptions({
        queryKey: EXPENSES_KEY,
        queryFn: ({ client }) => syncExpenses(client, outbox),
        gcTime: Infinity,
    });
};

export { RETRY_EVERY_MS, expensesQuery, inTurn, pushPending, syncExpenses };
