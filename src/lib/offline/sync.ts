import { queryOptions, type QueryClient } from '@tanstack/react-query';

import { ApiError, EXPENSES_KEY, fetchChanges, putExpense, type ExpensesState } from '@/lib/api';
import { upsertById } from '@core/expense-merge';

import type { Outbox } from './outbox';

// What the server said no to for good: the same write will never be accepted, so retrying is pointless
function isPermanent(error: unknown): boolean {
    return error instanceof ApiError && (error.status === 400 || error.status === 409 || error.status === 422);
}

// Sends what is pending, oldest first. The first failure that may pass on its own stops the run, keeping the order.
async function pushOutbox(client: QueryClient, outbox: Outbox): Promise<void> {
    await outbox.ready;

    for (const expense of [...outbox.getState().pending]) {
        try {
            const kept = await putExpense(expense);
            // The row the server kept goes into the cache before the outbox lets go of it, so it never blinks out
            client.setQueryData<ExpensesState>(EXPENSES_KEY, (state) =>
                state ? { ...state, expenses: upsertById(state.expenses, kept) } : state
            );
            await outbox.settle(expense);
        } catch (error) {
            if (!isPermanent(error)) throw error;
            await outbox.reject(expense);
        }
    }
}

async function pullChanges(client: QueryClient): Promise<ExpensesState> {
    const known = client.getQueryData<ExpensesState>(EXPENSES_KEY) ?? { expenses: [], cursor: 0 };
    const byId = new Map(known.expenses.map((expense) => [expense.id, expense]));
    let cursor = known.cursor;

    for (;;) {
        const page = await fetchChanges(cursor);
        for (const expense of page.expenses) byId.set(expense.id, expense);
        cursor = page.cursor;
        if (!page.hasMore) return { expenses: [...byId.values()], cursor };
    }
}

// Runs one at a time per outbox, so overlapping triggers never send the same expense twice
const running = new WeakMap<Outbox, Promise<unknown>>();

function syncExpenses(client: QueryClient, outbox: Outbox): Promise<ExpensesState> {
    const turn = (running.get(outbox) ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
            await pushOutbox(client, outbox);
            return pullChanges(client);
        });
    running.set(outbox, turn);
    return turn;
}

// The one place data moves: any trigger Query has (open, focus, reconnect, invalidation) runs a full sync
function expensesQuery(outbox: Outbox) {
    return queryOptions({
        queryKey: EXPENSES_KEY,
        queryFn: ({ client }) => syncExpenses(client, outbox),
        gcTime: Infinity,
    });
}

export { expensesQuery, syncExpenses };
