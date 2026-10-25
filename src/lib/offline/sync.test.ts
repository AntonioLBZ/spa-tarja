import { afterEach, describe, expect, it, vi } from 'vitest';

import { EXPENSES_KEY, type ExpensesState } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';
import { createFakeApi } from '@/lib/test/fake-api';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { stubApi } from '@/lib/test/render-app';

import { createOutbox } from './outbox';
import { expensesQuery, syncExpenses } from './sync';

import type { Expense } from '@core/expense';

function expense(id: string, overrides: Partial<Expense> = {}): Expense {
    return {
        id,
        categoryId: 'food',
        text: id,
        amountCents: 100,
        currency: 'EUR',
        date: '2026-10-25',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: null,
        ...overrides,
    };
}

function setup(options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi(options);
    stubApi(api.handler);
    const client = createQueryClient();
    const storage = createMemoryStorage();
    const outbox = createOutbox(storage);

    // Goes through the query like the app does; staleTime 0 so each call really syncs
    const sync = () => client.fetchQuery({ ...expensesQuery(outbox), staleTime: 0 });
    const cached = () => client.getQueryData<ExpensesState>(EXPENSES_KEY);

    return { api, client, outbox, storage, sync, cached };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('pulling changes', () => {
    it('loads everything on the first sync', async () => {
        const { sync } = setup({ expenses: [expense('a'), expense('b')] });

        const state = await sync();

        expect(state.expenses.map((item) => item.id)).toEqual(['a', 'b']);
        expect(state.cursor).toBe(2);
    });

    it('asks only for what changed after the cursor and merges it, tombstones included', async () => {
        const { api, sync } = setup({ expenses: [expense('a'), expense('b')] });
        await sync();

        api.serverWrite(expense('a', { text: 'edited', updatedAt: 2 }));
        api.serverWrite(expense('b', { deletedAt: 3, updatedAt: 3 }));
        api.serverWrite(expense('c'));
        const state = await sync();

        expect(api.requests.at(-1)).toBe('GET /api/expenses?after=2');
        expect(state.expenses.map((item) => [item.id, item.text, item.deletedAt])).toEqual([
            ['a', 'edited', null],
            ['b', 'b', 3],
            ['c', 'c', null],
        ]);
        expect(state.cursor).toBe(5);
    });

    it('follows the pages until the server has no more', async () => {
        const { sync } = setup({ expenses: ['a', 'b', 'c', 'd', 'e'].map((id) => expense(id)), pageSize: 2 });

        const state = await sync();

        expect(state.expenses).toHaveLength(5);
        expect(state.cursor).toBe(5);
    });
});

describe('pushing the outbox', () => {
    it('sends pending expenses before pulling, clears them, and shows the server result', async () => {
        const { api, outbox, sync } = setup();
        await outbox.put(expense('a'));

        const state = await sync();

        expect(api.writes.map((item) => item.id)).toEqual(['a']);
        expect(outbox.getState().pending).toEqual([]);
        expect(state.expenses.map((item) => item.id)).toEqual(['a']);
    });

    it('waits for the outbox to be read from storage', async () => {
        const { api, client } = setup();
        const storage = createMemoryStorage();
        await storage.set('tarja:outbox', [expense('saved-before')]);
        const outbox = createOutbox(storage);

        await client.fetchQuery({ ...expensesQuery(outbox), staleTime: 0 });

        expect(api.writes.map((item) => item.id)).toEqual(['saved-before']);
    });

    it('sends in the order they were saved', async () => {
        const { api, outbox, sync } = setup();
        await outbox.put(expense('first'));
        await outbox.put(expense('second'));
        await outbox.put(expense('third'));

        await sync();

        expect(api.attempts.map((item) => item.id)).toEqual(['first', 'second', 'third']);
    });

    it('keeps everything pending, in order, when the server is failing', async () => {
        const { api, outbox, sync } = setup();
        api.state.writeStatus = 503;
        await outbox.put(expense('a'));
        await outbox.put(expense('b'));

        await expect(sync()).rejects.toThrow();

        expect(api.attempts.map((item) => item.id)).toEqual(['a']);
        expect(outbox.getState().pending.map((item) => item.id)).toEqual(['a', 'b']);
        expect(outbox.getState().rejected).toBe(0);
    });

    it('keeps everything pending when the session has ended, so the next sign-in delivers it', async () => {
        const { api, outbox, sync } = setup();
        api.state.unauthorized = true;
        await outbox.put(expense('a'));

        await expect(sync()).rejects.toMatchObject({ status: 401 });

        expect(outbox.getState().pending.map((item) => item.id)).toEqual(['a']);
        expect(outbox.getState().rejected).toBe(0);
    });

    it('keeps everything pending when the connection is down, and delivers it once it is back', async () => {
        const { api, outbox, sync } = setup();
        api.state.offline = true;
        await outbox.put(expense('a'));
        await expect(sync()).rejects.toThrow();
        expect(outbox.getState().pending).toHaveLength(1);

        api.state.offline = false;
        await sync();

        expect(outbox.getState().pending).toEqual([]);
        expect(api.writes.map((item) => item.id)).toEqual(['a']);
    });

    it('drops an expense the server refuses for good and carries on with the rest', async () => {
        const { api, outbox, sync } = setup();
        api.state.writeStatus = 400;
        await outbox.put(expense('bad'));
        await expect(sync()).resolves.toBeDefined();
        expect(outbox.getState()).toEqual({ pending: [], rejected: 1 });

        api.state.writeStatus = null;
        await outbox.put(expense('good'));
        await sync();

        expect(api.writes.map((item) => item.id)).toEqual(['good']);
    });

    it('treats a taken id the same way', async () => {
        const { api, outbox, sync } = setup();
        api.state.writeStatus = 409;
        await outbox.put(expense('taken'));

        await sync();

        expect(outbox.getState()).toEqual({ pending: [], rejected: 1 });
    });

    it('does not send an expense twice when two syncs overlap', async () => {
        const { api, client, outbox } = setup();
        await outbox.put(expense('a'));

        await Promise.all([syncExpenses(client, outbox), syncExpenses(client, outbox)]);

        expect(api.attempts).toHaveLength(1);
    });
});
