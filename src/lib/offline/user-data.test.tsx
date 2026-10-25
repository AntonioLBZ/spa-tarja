import { QueryClient, dehydrate, onlineManager } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { EXPENSES_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER, createFakeAuth } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';

import { PERSIST_BUSTER, createPersister } from './persister';
import { createUserStorage } from './user-storage';

import type { AuthUser } from '@/lib/auth';
import type { Expense } from '@core/expense';

const BEA: AuthUser = { id: 'user-bea', name: 'Bea Ruiz', email: 'bea@example.com' };

const unsent: Expense = {
    id: crypto.randomUUID(),
    categoryId: 'food',
    text: 'Not sent yet',
    amountCents: 500,
    currency: 'EUR',
    date: '2026-10-25',
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
};

async function leaveUnsent(storage: ReturnType<typeof createMemoryStorage>, user: AuthUser) {
    await createUserStorage(storage, user.id).storage.set('tarja:outbox', [unsent]);
}

async function leaveCopy(storage: ReturnType<typeof createMemoryStorage>, user: AuthUser, expenses: Expense[]) {
    const source = new QueryClient();
    source.setQueryData(EXPENSES_KEY, { expenses, cursor: 1 });
    await createPersister(createUserStorage(storage, user.id).storage).persistClient({
        timestamp: Date.now(),
        buster: PERSIST_BUSTER,
        clientState: dehydrate(source),
    });
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('user data', () => {
    it("shows the user's own unsynced expenses and sends them", async () => {
        const storage = createMemoryStorage();
        await leaveUnsent(storage, TEST_USER);
        const api = createFakeApi();
        stubApi(api.handler);

        renderApp({ storage });

        expect(await screen.findByText(unsent.text)).toBeDefined();
        await waitFor(() => expect(api.writes.map((item) => item.id)).toEqual([unsent.id]));
    });

    it("neither shows nor sends another account's unsynced expenses", async () => {
        const storage = createMemoryStorage();
        await leaveUnsent(storage, TEST_USER);
        const api = createFakeApi();
        stubApi(api.handler);

        renderApp({ storage, fakeAuth: createFakeAuth({ session: BEA }) });

        expect(await screen.findByText(en.expenses.list.empty)).toBeDefined();
        expect(screen.queryByText(unsent.text)).toBeNull();
        expect(api.requests.filter((request) => request.startsWith('PUT'))).toEqual([]);
        expect(await storage.get(`tarja:outbox:${TEST_USER.id}`)).toEqual([unsent]);
    });

    it("shows the user's own copy of the expenses with the server out of reach", async () => {
        const storage = createMemoryStorage();
        await leaveCopy(storage, TEST_USER, [{ ...unsent, text: 'Copied' }]);
        const api = createFakeApi();
        api.state.offline = true;
        stubApi(api.handler);

        renderApp({ storage });

        expect(await screen.findByText('Copied')).toBeDefined();
    });

    it("does not show another account's copy of the expenses", async () => {
        const storage = createMemoryStorage();
        await leaveCopy(storage, TEST_USER, [{ ...unsent, text: 'Copied' }]);
        stubApi(createFakeApi().handler);

        renderApp({ storage, fakeAuth: createFakeAuth({ session: BEA }) });

        expect(await screen.findByText(en.expenses.list.empty)).toBeDefined();
        expect(screen.queryByText('Copied')).toBeNull();
    });

    it("hands the next account an empty app when the session turns out to be another's", async () => {
        const storage = createMemoryStorage();
        await leaveUnsent(storage, TEST_USER);
        const api = createFakeApi();
        stubApi(api.handler);
        onlineManager.setOnline(false);
        const fakeAuth = createFakeAuth();
        renderApp({ storage, fakeAuth });
        const row = (await screen.findByText(unsent.text)).closest('li')!;
        expect(within(row).getByText(en.expenses.list.pending)).toBeDefined();

        fakeAuth.state.session = BEA;
        await fakeAuth.auth.check();
        onlineManager.setOnline(true);

        expect(await screen.findByText(en.expenses.list.empty)).toBeDefined();
        expect(screen.queryByText(unsent.text)).toBeNull();
        expect(api.requests.filter((request) => request.startsWith('PUT'))).toEqual([]);
        expect(await storage.get(`tarja:outbox:${TEST_USER.id}`)).toEqual([unsent]);
    });
});
