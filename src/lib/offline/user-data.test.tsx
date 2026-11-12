import { QueryClient, dehydrate, onlineManager } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { EXPENSES_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER, createFakeAuth } from '@/lib/test/fake-auth';
import { leaveCopy as leaveGroupsCopy, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';

import { PERSIST_BUSTER, createPersister } from './persister';
import { readSharedWith, rememberSharedWith } from './shared-with';
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

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.useRealTimers();
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

    it("hands another account an empty outbox of groups and leaves the first one's on the device", async () => {
        const storage = createMemoryStorage();
        const entry = { id: crypto.randomUUID(), groupId: crypto.randomUUID(), updatedAt: 1 };
        await createUserStorage(storage, TEST_USER.id).storage.set('tarja:group-outbox', [entry]);
        stubApi(createFakeApi().handler);

        const app = renderApp({ storage, fakeAuth: createFakeAuth({ session: BEA }) });

        await screen.findByText(en.expenses.list.empty);
        await app.groupOutbox.ready;
        expect(app.groupOutbox.getState().pending).toEqual([]);
        expect(await storage.get(`tarja:group-outbox:${TEST_USER.id}`)).toEqual([entry]);
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

describe('a window left open while the browser changes account', () => {
    const ofBea: Expense = { ...unsent, id: crypto.randomUUID(), text: 'Of Bea' };

    async function leaveWorkOf(storage: ReturnType<typeof createMemoryStorage>) {
        const group = sampleGroup();
        const entry = sampleEntry(group);
        await leaveUnsent(storage, TEST_USER);
        await createUserStorage(storage, TEST_USER.id).storage.set('tarja:group-outbox', [entry]);
        await leaveGroupsCopy(storage, [group], []);
        return { group, entry };
    }

    async function openedByAna() {
        const storage = createMemoryStorage();
        const { group, entry } = await leaveWorkOf(storage);
        const api = createFakeApi({ groups: [group], expenses: [ofBea] });
        stubApi(api.handler);
        onlineManager.setOnline(false);
        const fakeAuth = createFakeAuth();
        const app = renderApp({ storage, fakeAuth });
        await screen.findByText(unsent.text);
        await app.groupOutbox.ready;
        return { storage, entry, api, fakeAuth, app };
    }

    function switchToBea(api: ReturnType<typeof createFakeApi>, fakeAuth: ReturnType<typeof createFakeAuth>) {
        api.state.cookieUser = BEA.id;
        fakeAuth.state.session = BEA;
    }

    it('names the account it was opened for on every call', async () => {
        const { api } = await openedByAna();

        onlineManager.setOnline(true);

        await waitFor(() => expect(api.requestUsers.length).toBeGreaterThan(0));
        const named = api.requestUsers.filter((entry) => !entry.request.includes('/api/health'));
        expect(named.length).toBeGreaterThan(0);
        expect(new Set(named.map((entry) => entry.user))).toEqual(new Set([TEST_USER.id]));
    });

    it('sends nothing of the first account with the second one’s session, and ends on the second', async () => {
        const { storage, entry, api, fakeAuth } = await openedByAna();
        switchToBea(api, fakeAuth);

        onlineManager.setOnline(true);

        expect(await screen.findByText(ofBea.text)).toBeDefined();
        expect(screen.queryByText(unsent.text)).toBeNull();
        expect(api.writes).toEqual([]);
        expect(api.entryWrites).toEqual([]);
        expect(api.attempts).toEqual([]);
        expect(api.entryAttempts).toEqual([]);
        expect(fakeAuth.auth.getState()).toMatchObject({ status: 'signed-in', user: BEA });
        expect(await storage.get(`tarja:outbox:${TEST_USER.id}`)).toEqual([unsent]);
        expect(await storage.get(`tarja:group-outbox:${TEST_USER.id}`)).toEqual([entry]);
    });

    it('puts nothing of the second account in the cache of the first', async () => {
        const { storage, api, fakeAuth } = await openedByAna();
        switchToBea(api, fakeAuth);

        onlineManager.setOnline(true);

        await screen.findByText(ofBea.text);
        await waitFor(async () => expect(await storage.get(`tarja:query-cache:${BEA.id}`)).toBeDefined());
        expect(JSON.stringify(await storage.get(`tarja:query-cache:${TEST_USER.id}`))).not.toContain(ofBea.text);
        expect(await storage.get(`tarja:outbox:${BEA.id}`)).toBeUndefined();
        expect(await storage.get(`tarja:group-outbox:${BEA.id}`)).toBeUndefined();
    });

    it('hands the second account empty outboxes, and stops those of the first', async () => {
        const { api, fakeAuth, app } = await openedByAna();
        const first = { outbox: app.outbox, groupOutbox: app.groupOutbox };
        switchToBea(api, fakeAuth);

        onlineManager.setOnline(true);

        await screen.findByText(ofBea.text);
        expect(app.outbox).not.toBe(first.outbox);
        expect(app.outbox.getState().pending).toEqual([]);
        expect(app.groupOutbox.getState().pending).toEqual([]);
        expect(first.outbox.isPaused()).toBe(true);
        expect(first.groupOutbox.isPaused()).toBe(true);
    });

    it('asks who is signed in a few times, not over and over', async () => {
        const { api, fakeAuth } = await openedByAna();
        switchToBea(api, fakeAuth);

        onlineManager.setOnline(true);

        await screen.findByText(ofBea.text);
        const checks = fakeAuth.calls.getSession;
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(fakeAuth.calls.getSession).toBe(checks);
        expect(checks).toBeLessThanOrEqual(4);
    });

    it('stops sending the expenses of the first account once the second takes over', async () => {
        const storage = createMemoryStorage();
        const second: Expense = { ...unsent, id: crypto.randomUUID(), text: 'Second one' };
        await createUserStorage(storage, TEST_USER.id).storage.set('tarja:outbox', [unsent, second]);
        const api = createFakeApi();
        stubApi(api.handler);
        const release = api.hold();
        const fakeAuth = createFakeAuth();
        renderApp({ storage, fakeAuth });
        await waitFor(() => expect(api.requests.some((request) => request.startsWith('PUT'))).toBe(true));

        fakeAuth.state.session = BEA;
        await fakeAuth.auth.check();
        release();

        await waitFor(() => expect(api.writes.map((expense) => expense.id)).toEqual([unsent.id]));
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(api.writes.map((expense) => expense.id)).toEqual([unsent.id]);
        expect(await storage.get(`tarja:outbox:${BEA.id}`)).toBeUndefined();
    });
});

describe('a session that ends', () => {
    async function openWithACopy(waiting: 'nothing' | 'expense' | 'entry') {
        const storage = createMemoryStorage();
        await leaveCopy(storage, TEST_USER, [{ ...unsent, id: crypto.randomUUID(), text: 'Copied' }]);
        await leaveCopy(storage, BEA, [{ ...unsent, id: crypto.randomUUID(), text: 'Of Bea' }]);
        if (waiting === 'expense') await leaveUnsent(storage, TEST_USER);
        if (waiting === 'entry') {
            const entry = sampleEntry(sampleGroup());
            await createUserStorage(storage, TEST_USER.id).storage.set('tarja:group-outbox', [entry]);
        }
        rememberSharedWith(TEST_USER.id, 'a-group');
        rememberSharedWith(BEA.id, 'another-group');
        const api = createFakeApi();
        api.state.offline = true;
        stubApi(api.handler);
        onlineManager.setOnline(false);
        const fakeAuth = createFakeAuth();
        const app = renderApp({ storage, fakeAuth });
        await screen.findByText('Copied');
        await app.outbox.ready;
        await app.groupOutbox.ready;
        return { storage, fakeAuth, api };
    }

    async function theServerSaysNobodyIsSignedIn(fakeAuth: ReturnType<typeof createFakeAuth>) {
        fakeAuth.state.session = null;
        await fakeAuth.auth.check();
        await screen.findByRole('heading', { name: en.auth.title });
    }

    async function settle() {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    it('deletes the copy of that user, and nobody else’s, when nothing is waiting to be sent', async () => {
        const { storage, fakeAuth } = await openWithACopy('nothing');

        await theServerSaysNobodyIsSignedIn(fakeAuth);

        await waitFor(async () => expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeUndefined());
        expect(readSharedWith(TEST_USER.id)).toBeNull();
        expect(await storage.get(`tarja:query-cache:${BEA.id}`)).toBeDefined();
        expect(readSharedWith(BEA.id)).toBe('another-group');
    });

    it('deletes the copy when a request answers 401 and the server then says nobody is signed in', async () => {
        const { storage, fakeAuth, api } = await openWithACopy('nothing');
        api.state.offline = false;
        api.state.unauthorized = true;
        onlineManager.setOnline(true);
        fakeAuth.state.session = null;

        await screen.findByRole('heading', { name: en.auth.title });

        await waitFor(async () => expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeUndefined());
    });

    it('keeps everything while an expense is waiting to be sent', async () => {
        const { storage, fakeAuth } = await openWithACopy('expense');

        await theServerSaysNobodyIsSignedIn(fakeAuth);
        await settle();

        expect(await storage.get(`tarja:outbox:${TEST_USER.id}`)).toEqual([unsent]);
        expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined();
        expect(readSharedWith(TEST_USER.id)).toBe('a-group');
    });

    it('keeps everything while an expense of a group is waiting to be sent', async () => {
        const { storage, fakeAuth } = await openWithACopy('entry');

        await theServerSaysNobodyIsSignedIn(fakeAuth);
        await settle();

        expect(await storage.get(`tarja:group-outbox:${TEST_USER.id}`)).toHaveLength(1);
        expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined();
        expect(readSharedWith(TEST_USER.id)).toBe('a-group');
    });

    it.each([
        ['tarja:outbox', [unsent]],
        ['tarja:group-outbox', [sampleEntry(sampleGroup())]],
    ])('keeps everything while another window has saved a write in %s since this one opened', async (key, saved) => {
        const { storage, fakeAuth } = await openWithACopy('nothing');
        await createUserStorage(storage, TEST_USER.id).storage.set(key, saved);

        await theServerSaysNobodyIsSignedIn(fakeAuth);
        await settle();

        expect(await storage.get(`${key}:${TEST_USER.id}`)).toEqual(saved);
        expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined();
        expect(readSharedWith(TEST_USER.id)).toBe('a-group');
    });

    it('deletes nothing when the server cannot be asked, and the user stays signed in', async () => {
        const { storage, fakeAuth } = await openWithACopy('nothing');

        fakeAuth.state.offline = true;
        await fakeAuth.auth.check();
        await settle();

        expect(fakeAuth.auth.getState()).toMatchObject({ status: 'signed-in', user: TEST_USER });
        expect(screen.queryByRole('heading', { name: en.auth.title })).toBeNull();
        expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined();
        expect(readSharedWith(TEST_USER.id)).toBe('a-group');
    });

    it('deletes nothing when another account takes over the browser', async () => {
        const { storage, fakeAuth } = await openWithACopy('nothing');

        fakeAuth.state.session = BEA;
        await fakeAuth.auth.check();
        await settle();

        expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined();
        expect(readSharedWith(TEST_USER.id)).toBe('a-group');
    });
});

describe('opening the app', () => {
    function holdAnswers(api: ReturnType<typeof createFakeApi>) {
        const asked: string[] = [];
        const held: Array<() => void> = [];
        stubApi((url, init) => {
            asked.push(`${init?.method ?? 'GET'} ${url.pathname}`);
            return new Promise((resolve) => held.push(() => resolve(api.handler(url, init))));
        });
        return { asked, release: () => held.splice(0).forEach((answer) => answer()) };
    }

    async function leaveStaleCopy(storage: ReturnType<typeof createMemoryStorage>) {
        const group = sampleGroup();
        await leaveGroupsCopy(storage, [group], []);
        vi.setSystemTime(new Date(2026, 9, 25, 12, 5));
        return group;
    }

    it('asks for the expenses, the groups and the entries of each group it holds at once, none waiting for another', async () => {
        const storage = createMemoryStorage();
        const group = await leaveStaleCopy(storage);
        const { asked, release } = holdAnswers(createFakeApi({ groups: [group] }));

        renderApp({ storage });

        await waitFor(() =>
            expect(asked).toEqual(
                expect.arrayContaining(['GET /api/expenses', 'GET /api/groups', `GET /api/groups/${group.id}/entries`])
            )
        );
        release();
    });

    it('sends what waits in each outbox before it asks for what changed there', async () => {
        const storage = createMemoryStorage();
        const group = await leaveStaleCopy(storage);
        const entry = sampleEntry(group);
        await leaveUnsent(storage, TEST_USER);
        await createUserStorage(storage, TEST_USER.id).storage.set('tarja:group-outbox', [entry]);
        const { asked, release } = holdAnswers(createFakeApi({ groups: [group] }));

        renderApp({ storage });

        await waitFor(() =>
            expect(asked).toEqual(
                expect.arrayContaining([
                    `PUT /api/expenses/${unsent.id}`,
                    `PUT /api/groups/${group.id}/entries/${entry.id}`,
                    'GET /api/groups',
                ])
            )
        );
        expect(asked).not.toContain('GET /api/expenses');
        expect(asked).not.toContain(`GET /api/groups/${group.id}/entries`);
        release();
        await waitFor(() =>
            expect(asked).toEqual(expect.arrayContaining(['GET /api/expenses', `GET /api/groups/${group.id}/entries`]))
        );
        release();
    });
});
