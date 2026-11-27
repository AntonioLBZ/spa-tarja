import { QueryClient, dehydrate, onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { EXPENSES_KEY, GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { PERSIST_BUSTER, createPersister, createUserStorage } from '@/lib/offline';
import { createFakeApi } from '@/lib/testing/fake-api';
import { TEST_USER } from '@/lib/testing/fake-auth';
import { leaveCopy, sampleEntry } from '@/lib/testing/groups';
import { createMemoryStorage } from '@/lib/testing/memory-storage';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { type Download, expense, GYM, halves, open, readBlob, trip } from '@/lib/testing/your-data';

import type { SharedGroup } from '@core/groups/shared-group';

let downloads: Download[];

async function press(name: string) {
    const before = downloads.length;
    fireEvent.click(screen.getByRole('button', { name }));
    await waitFor(() => expect(downloads.length).toBe(before + 1));
    return downloads.at(-1)!;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    downloads = [];
    const pending: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: (blob: Blob) => {
            pending.push(blob);
            return `blob:tarja-${pending.length}`;
        },
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        const blob = pending[Number(this.href.split('-').at(-1)) - 1]!;
        void readBlob(blob).then((text) => downloads.push({ name: this.download, type: blob.type, text }));
    });
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
});

describe('while the groups are loading', () => {
    const json = () => screen.getByRole('button', { name: en.settings.data.json }) as HTMLButtonElement;
    const csv = () => screen.getByRole('button', { name: en.settings.data.csv }) as HTMLButtonElement;

    const settings = async (app: ReturnType<typeof renderApp>) => {
        await screen.findByRole('heading', { name: en.settings.data.title });
        await waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
    };

    it('waits for the groups, with both buttons off and a notice that says what for', async () => {
        const group = trip();
        const api = createFakeApi({ groups: [group], entries: [sampleEntry(group, { text: 'Dinner' })] });
        stubApi(api.handler);
        const release = api.hold();
        renderApp({ path: '/settings/account' });
        await screen.findByRole('heading', { name: en.settings.data.title });

        expect(screen.getByText(en.settings.data.loading).closest('[role="status"]')).not.toBeNull();
        expect(json().disabled).toBe(true);
        expect(csv().disabled).toBe(true);

        release();

        await waitFor(() => expect(json().disabled).toBe(false));
        expect(csv().disabled).toBe(false);
        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        const file = await press(en.settings.data.json);
        expect(JSON.parse(file.text).groups).toHaveLength(1);
    });

    it('waits for the entries of a group too', async () => {
        const group = trip();
        const api = createFakeApi({ groups: [group], entries: [sampleEntry(group, { text: 'Dinner' })] });
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        stubApi(async (url, init) => {
            if (url.pathname.endsWith('/entries')) await gate;
            return api.handler(url, init);
        });
        const app = renderApp({ path: '/settings/account' });
        await settings(app);
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));

        expect(screen.getByText(en.settings.data.loading)).toBeDefined();
        expect(csv().disabled).toBe(true);

        release();

        await waitFor(() => expect(csv().disabled).toBe(false));
        expect((await press(en.settings.data.csv)).text).toContain('Dinner');
    });

    const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

    const stall = async (path: (pathname: string) => boolean, options: Parameters<typeof createFakeApi>[0]) => {
        const api = createFakeApi(options);
        stubApi((url, init) => {
            if (path(url.pathname)) return new Promise<Response>(() => undefined);
            return api.handler(url, init);
        });
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        const app = renderApp({ path: '/settings/account' });
        await advance(1_000);
        await vi.waitFor(() => expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success'));
    };

    it('stops waiting after ten seconds for a request that never answers, and says what is left out', async () => {
        await stall((pathname) => pathname.endsWith('/entries'), {
            expenses: [expense({ text: 'Mine' })],
            groups: [trip()],
        });

        expect(screen.getByText(en.settings.data.loading)).toBeDefined();
        expect(csv().disabled).toBe(true);

        await advance(5_000);

        expect(csv().disabled).toBe(true);

        await advance(6_000);

        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        expect(screen.getByText(en.settings.data.missing).closest('[role="status"]')).not.toBeNull();
        expect(json().disabled).toBe(false);
        expect(csv().disabled).toBe(false);

        vi.useRealTimers();
        const backup = JSON.parse((await press(en.settings.data.json)).text);
        expect(backup.groups).toEqual([]);
        expect(backup.expenses).toHaveLength(1);
    });

    it('stops waiting after ten seconds for the groups too', async () => {
        await stall((pathname) => pathname === '/api/groups', {
            expenses: [expense({ text: 'Mine' })],
            groups: [trip()],
        });

        expect(json().disabled).toBe(true);

        await advance(11_000);

        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        expect(json().disabled).toBe(false);
        expect(csv().disabled).toBe(false);
    });

    it('leaves out a group whose expenses cannot be had, says so, and exports the rest', async () => {
        const lost = trip({ name: 'Lost' });
        const found = trip({ name: 'Found' });
        const api = createFakeApi({
            expenses: [expense({ text: 'Mine' })],
            groups: [lost, found],
            entries: [sampleEntry(lost, { text: 'Lost dinner' }), sampleEntry(found, { text: 'Found dinner' })],
        });
        stubApi((url, init) => {
            if (url.pathname === `/api/groups/${lost.id}/entries`) throw new TypeError('Failed to fetch');
            return api.handler(url, init);
        });
        const app = renderApp({ path: '/settings/account' });
        await settings(app);
        await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(lost.id))?.status).toBe('error'));
        await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(found.id))?.status).toBe('success'));

        expect(screen.getByText(en.settings.data.missing).closest('[role="status"]')).not.toBeNull();
        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        const backup = JSON.parse((await press(en.settings.data.json)).text);
        const sheet = (await press(en.settings.data.csv)).text;

        expect(backup.groups.map((item: SharedGroup) => item.name)).toEqual(['Found']);
        expect(backup.expenses).toHaveLength(1);
        expect(sheet).toContain('Found dinner');
        expect(sheet).not.toContain('Lost dinner');
    });

    it('says the same offline, when the device holds a group but never pulled its expenses', async () => {
        const group = trip();
        const storage = createMemoryStorage();
        const source = new QueryClient();
        source.setQueryData(GROUPS_KEY, [group]);
        await createPersister(createUserStorage(storage, TEST_USER.id).storage).persistClient({
            timestamp: Date.now(),
            buster: PERSIST_BUSTER,
            clientState: dehydrate(source),
        });
        onlineManager.setOnline(false);
        stubApi(createFakeApi({ groups: [group] }).handler);
        renderApp({ path: '/settings/account', storage });
        await screen.findByRole('heading', { name: en.settings.data.title });

        await screen.findByText(en.settings.data.missing);

        expect(json().disabled).toBe(false);
        expect(JSON.parse((await press(en.settings.data.json)).text).groups).toEqual([]);
    });

    it('says nothing when the device never heard of its groups, and exports what it has', async () => {
        const api = createFakeApi({ expenses: [expense({ text: 'Mine' })], groups: [trip()] });
        stubApi((url, init) => {
            if (url.pathname === '/api/groups') throw new TypeError('Failed to fetch');
            return api.handler(url, init);
        });
        const app = renderApp({ path: '/settings/account' });
        await settings(app);
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('error'));

        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        expect(screen.queryByText(en.settings.data.missing)).toBeNull();
        const backup = JSON.parse((await press(en.settings.data.json)).text);
        expect(backup.groups).toEqual([]);
        expect(backup.expenses).toHaveLength(1);
    });

    it('works from the copy the device kept, offline from the start', async () => {
        const storage = createMemoryStorage();
        const group = trip();
        await leaveCopy(storage, [group], [sampleEntry(group, { text: 'Dinner', shares: halves(2000) })]);
        onlineManager.setOnline(false);
        const api = createFakeApi({ groups: [group] });
        api.state.offline = true;
        stubApi(api.handler);
        const app = renderApp({ path: '/settings/account', storage });
        await screen.findByRole('heading', { name: en.settings.data.title });
        await waitFor(() => expect(app.queryClient.getQueryData(groupEntriesKey(group.id))).toBeDefined());

        expect(json().disabled).toBe(false);
        expect(screen.queryByText(en.settings.data.loading)).toBeNull();
        expect(screen.queryByText(en.settings.data.missing)).toBeNull();
        expect((await press(en.settings.data.csv)).text).toContain('Dinner');
        expect(JSON.parse((await press(en.settings.data.json)).text).groups).toHaveLength(1);
    });
});

describe('offline', () => {
    it('makes both files from the local copy and sends nothing, with the server out of reach', async () => {
        const { api, fetchMock } = await open({
            expenses: [expense({ text: 'Lunch' })],
            categories: [GYM],
            budgets: [{ month: '2026-10', scope: 'food', amountCents: 30_000, currency: 'EUR' }],
        });
        api.state.offline = true;
        onlineManager.setOnline(false);
        const calls = fetchMock.mock.calls.length;
        const requests = api.requests.length;

        const json = await press(en.settings.data.json);
        const csv = await press(en.settings.data.csv);

        expect(JSON.parse(json.text).expenses).toHaveLength(1);
        expect(JSON.parse(json.text).budgets).toHaveLength(1);
        expect(csv.text).toContain('Lunch');
        expect(fetchMock.mock.calls).toHaveLength(calls);
        expect(api.requests).toHaveLength(requests);
        expect(api.writes).toHaveLength(0);
    });

    it('makes both files with the groups from the local copy, and sends nothing', async () => {
        const group = trip();
        const { api, fetchMock } = await open({
            groups: [group],
            entries: [sampleEntry(group, { text: 'Dinner', shares: halves(2000) })],
        });
        api.state.offline = true;
        onlineManager.setOnline(false);
        const calls = fetchMock.mock.calls.length;
        const requests = api.requests.length;

        const json = await press(en.settings.data.json);
        const csv = await press(en.settings.data.csv);

        expect(JSON.parse(json.text).groups[0].entries).toHaveLength(1);
        expect(csv.text).toContain('Dinner');
        expect(fetchMock.mock.calls).toHaveLength(calls);
        expect(api.requests).toHaveLength(requests);
        expect(api.writes).toHaveLength(0);
    });

    it('opens the settings and presses nothing without writing anything to the server', async () => {
        const { api } = await open({ expenses: [expense()] });

        expect(api.requests.every((request) => request.startsWith('GET '))).toBe(true);
        expect(api.attempts).toHaveLength(0);
    });
});
