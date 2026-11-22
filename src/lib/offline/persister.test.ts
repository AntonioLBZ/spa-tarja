import { QueryClient, dehydrate } from '@tanstack/react-query';
import { persistQueryClientRestore } from '@tanstack/react-query-persist-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    BUDGETS_KEY,
    CATEGORIES_KEY,
    EXPENSES_KEY,
    GROUPS_KEY,
    INCOME_KEY,
    PROFILE_KEY,
    groupEntriesKey,
    invitationQuery,
    pendingInvitationsQuery,
} from '@/lib/api';
import { createMemoryStorage } from '@/lib/test/memory-storage';

import {
    PERSIST_BUSTER,
    PERSIST_EVERY_MS,
    QUERY_CACHE_STORAGE_KEY,
    createPersistOptions,
    createPersister,
} from './persister';

const state = { expenses: [], cursor: 7 };

const TOKEN = `0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.${'A'.repeat(43)}`;

async function storeCopy(storage: ReturnType<typeof createMemoryStorage>, copy: { timestamp: number; buster: string }) {
    const source = new QueryClient();
    source.setQueryData(EXPENSES_KEY, state);
    await createPersister(storage).persistClient({ ...copy, clientState: dehydrate(source) });
}

describe('createPersistOptions', () => {
    it('keeps the expenses, the categories, the income, the budgets, the groups and their entries, and nothing else', () => {
        const client = new QueryClient();
        client.setQueryData(EXPENSES_KEY, state);
        client.setQueryData(CATEGORIES_KEY, []);
        client.setQueryData(INCOME_KEY, []);
        client.setQueryData(BUDGETS_KEY, []);
        client.setQueryData(GROUPS_KEY, []);
        client.setQueryData(groupEntriesKey('trip'), { entries: [], cursor: 3 });
        client.setQueryData(groupEntriesKey('friend'), { entries: [], cursor: 1 });
        client.setQueryData(PROFILE_KEY, { nickname: null, name: 'Ana' });
        client.setQueryData(['health'], { ok: true });
        const { dehydrateOptions } = createPersistOptions(createMemoryStorage());

        const keys = dehydrate(client, dehydrateOptions).queries.map((query) => query.queryKey);

        expect(keys).toEqual([
            EXPENSES_KEY,
            CATEGORIES_KEY,
            INCOME_KEY,
            BUDGETS_KEY,
            GROUPS_KEY,
            groupEntriesKey('trip'),
            groupEntriesKey('friend'),
        ]);
    });

    it('never keeps a link of an invitation, nor what it shows', () => {
        const client = new QueryClient();
        client.setQueryData(GROUPS_KEY, []);
        client.setQueryData(invitationQuery(TOKEN).queryKey, { name: 'Ana' });
        client.setQueryData(pendingInvitationsQuery().queryKey, [{ id: 'link', token: TOKEN, expiresAt: 1 }]);
        const { dehydrateOptions } = createPersistOptions(createMemoryStorage());

        const queries = dehydrate(client, dehydrateOptions).queries;

        expect(queries.map((query) => query.queryKey)).toEqual([GROUPS_KEY]);
        expect(JSON.stringify(queries)).not.toContain(TOKEN);
    });

    it('keeps the expenses when the latest sync failed, so a bad connection never wipes the local copy', async () => {
        const client = new QueryClient();
        client.setQueryData(EXPENSES_KEY, state);
        await client
            .fetchQuery({ queryKey: EXPENSES_KEY, queryFn: () => Promise.reject(new Error('offline')), staleTime: 0 })
            .catch(() => undefined);
        expect(client.getQueryState(EXPENSES_KEY)?.status).toBe('error');
        const { dehydrateOptions } = createPersistOptions(createMemoryStorage());

        const [persisted] = dehydrate(client, dehydrateOptions).queries;

        expect(persisted?.state.data).toEqual(state);
    });

    it('brings back a copy however old it is', async () => {
        const storage = createMemoryStorage();
        await storeCopy(storage, { timestamp: Date.UTC(2020, 0, 1), buster: PERSIST_BUSTER });
        const queryClient = new QueryClient();

        await persistQueryClientRestore({ queryClient, ...createPersistOptions(storage) });

        expect(queryClient.getQueryData(EXPENSES_KEY)).toEqual(state);
    });

    it('throws away a copy written for another version of the data', async () => {
        const storage = createMemoryStorage();
        await storeCopy(storage, { timestamp: Date.now(), buster: 'an-older-shape' });
        const queryClient = new QueryClient();

        await persistQueryClientRestore({ queryClient, ...createPersistOptions(storage) });

        expect(queryClient.getQueryData(EXPENSES_KEY)).toBeUndefined();
    });
});

describe('createPersister', () => {
    const copy = (cursor: number) => {
        const source = new QueryClient();
        source.setQueryData(EXPENSES_KEY, { expenses: [], cursor });
        return { timestamp: cursor, buster: PERSIST_BUSTER, clientState: dehydrate(source) };
    };
    const writer = () => {
        const storage = createMemoryStorage();
        const set = vi.spyOn(storage, 'set');
        return { storage, set, persister: createPersister(storage) };
    };

    afterEach(() => vi.useRealTimers());

    it('writes the first change at once and the ones that follow within a second together, the latest of them', async () => {
        vi.useFakeTimers();
        const { storage, set, persister } = writer();

        await persister.persistClient(copy(1));
        await persister.persistClient(copy(2));
        await persister.persistClient(copy(3));

        expect(set).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(PERSIST_EVERY_MS);
        expect(set).toHaveBeenCalledTimes(2);
        expect((await storage.get<{ timestamp: number }>(QUERY_CACHE_STORAGE_KEY))?.timestamp).toBe(3);
    });

    it('writes at once again once a second has gone by with no change', async () => {
        vi.useFakeTimers();
        const { set, persister } = writer();

        await persister.persistClient(copy(1));
        await vi.advanceTimersByTimeAsync(PERSIST_EVERY_MS);
        await persister.persistClient(copy(2));

        expect(set).toHaveBeenCalledTimes(2);
    });

    it('writes the copy waiting at once when told to flush, and nothing when none waits', async () => {
        vi.useFakeTimers();
        const { storage, set, persister } = writer();

        await persister.flush();
        expect(set).not.toHaveBeenCalled();
        await persister.persistClient(copy(1));
        await persister.persistClient(copy(2));
        await persister.flush();

        expect(set).toHaveBeenCalledTimes(2);
        expect((await storage.get<{ timestamp: number }>(QUERY_CACHE_STORAGE_KEY))?.timestamp).toBe(2);
        await vi.advanceTimersByTimeAsync(PERSIST_EVERY_MS);
        expect(set).toHaveBeenCalledTimes(2);
    });

    it('drops a write still waiting when the copy is removed, so it never comes back', async () => {
        vi.useFakeTimers();
        const { storage, persister } = writer();

        await persister.persistClient(copy(1));
        await persister.persistClient(copy(2));
        await persister.removeClient();
        await vi.advanceTimersByTimeAsync(PERSIST_EVERY_MS);

        expect(await storage.get(QUERY_CACHE_STORAGE_KEY)).toBeUndefined();
    });
});
