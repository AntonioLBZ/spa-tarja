import { focusManager, onlineManager, useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUserStorage, useGroupOutbox } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER, createFakeAuth } from '@/lib/test/fake-auth';
import { leaveCopy, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderAppHook, stubApi } from '@/lib/test/render-app';

import { useLedger, useLedgers } from './use-ledgers';

import type { AuthUser } from '@/lib/auth';

const BEA: AuthUser = { id: 'user-bea', name: 'Bea Ruiz', email: 'bea@example.com' };

const group = sampleGroup();
const bea = group.members[1]!.id;

function renderLedgers(options: Parameters<typeof renderAppHook>[1] = {}) {
    return renderAppHook(() => ({ ...useLedgers(), outbox: useGroupOutbox() }), options);
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('useLedgers', () => {
    it('reads every group and its entries from the server, each by its own cursor', async () => {
        const other = sampleGroup({ kind: 'direct', name: null });
        const [dinner, lunch] = [sampleEntry(group), sampleEntry(other, { text: 'Lunch' })];
        const api = createFakeApi({ groups: [group, other], entries: [dinner, lunch] });
        stubApi(api.handler);

        const { result } = renderLedgers();

        await waitFor(() => expect(result.current.ledgers.map((ledger) => ledger.hasData)).toEqual([true, true]));
        expect(
            result.current.ledgers.map((ledger) => [ledger.group.id, ledger.entries.map((entry) => entry.text)])
        ).toEqual([
            [group.id, ['Dinner']],
            [other.id, ['Lunch']],
        ]);
        expect(api.requests).toContain(`GET /api/groups/${group.id}/entries?after=0`);
        expect(api.requests).toContain(`GET /api/groups/${other.id}/entries?after=0`);
    });

    it('reads the groups and their entries from the local copy with the server out of reach', async () => {
        const storage = createMemoryStorage();
        const closed = sampleGroup({ closed: 'left', archived: true });
        await leaveCopy(storage, [group, closed], [sampleEntry(group), sampleEntry(closed, { text: 'Before I left' })]);
        const api = createFakeApi();
        api.state.offline = true;
        stubApi(api.handler);

        const { result } = renderLedgers({ storage });

        await waitFor(() => expect(result.current.ledgers).toHaveLength(2));
        expect(result.current.ledgers.map((ledger) => ledger.entries.map((entry) => entry.text))).toEqual([
            ['Dinner'],
            ['Before I left'],
        ]);
        expect(result.current.ledgers[1]!.group).toMatchObject({ closed: 'left', archived: true });
    });

    it("shows the person's own unsynced write over the version the server holds, and marks it pending", async () => {
        const entry = sampleEntry(group);
        const api = createFakeApi({ groups: [group], entries: [entry] });
        stubApi(api.handler);
        const { result } = renderLedgers();
        await waitFor(() => expect(result.current.ledgers[0]?.hasData).toBe(true));
        onlineManager.setOnline(false);
        api.serverWriteEntry({ ...entry, text: 'Older, by Bea', updatedAt: 2 }, bea);

        const mine = { ...entry, text: 'Mine', updatedAt: 3 };
        await act(() => result.current.outbox.put(mine));

        expect(result.current.ledgers[0]!.entries).toMatchObject([{ id: entry.id, text: 'Mine', updatedBy: group.me }]);
        expect(result.current.pendingIds.has(entry.id)).toBe(true);
    });

    it('keeps who made an entry when the person edits it and the edit waits to be sent', async () => {
        const made = sampleEntry(group, { paidBy: bea });
        stubApi(createFakeApi({ groups: [group], entries: [{ ...made, createdBy: bea, updatedBy: bea }] }).handler);
        const { result } = renderLedgers();
        await waitFor(() => expect(result.current.ledgers[0]?.hasData).toBe(true));
        onlineManager.setOnline(false);

        await act(() => result.current.outbox.put({ ...made, text: 'Edited by me', updatedAt: 2 }));

        expect(result.current.ledgers[0]!.entries).toMatchObject([
            { id: made.id, text: 'Edited by me', createdBy: bea, updatedBy: group.me },
        ]);
    });

    it('tries a waiting write again every 30 s, with no other trigger', async () => {
        const api = createFakeApi({ groups: [group] });
        stubApi(api.handler);
        const { result } = renderLedgers();
        await waitFor(() => expect(result.current.ledgers[0]?.hasData).toBe(true));
        api.state.entryRefusal = { status: 503 };
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

        await act(() => result.current.outbox.put(sampleEntry(group)));
        expect(api.entryAttempts).toHaveLength(0);
        await act(() => vi.advanceTimersByTimeAsync(30_000));
        await vi.waitFor(() => expect(api.entryAttempts).toHaveLength(1));
        api.state.entryRefusal = null;
        await act(() => vi.advanceTimersByTimeAsync(30_000));

        await vi.waitFor(() => expect(result.current.outbox.getState().pending).toEqual([]));
        expect(api.entryAttempts).toHaveLength(2);
    });

    it('shows a new entry waiting to be sent as made by the person', async () => {
        stubApi(createFakeApi({ groups: [group] }).handler);
        const { result } = renderLedgers();
        await waitFor(() => expect(result.current.ledgers[0]?.hasData).toBe(true));
        onlineManager.setOnline(false);

        const entry = sampleEntry(group);
        await act(() => result.current.outbox.put(entry));

        expect(result.current.ledgers[0]!.entries).toMatchObject([
            { id: entry.id, createdBy: group.me, updatedBy: group.me },
        ]);
    });

    it("gives another account on the device none of the first one's groups, entries or writes", async () => {
        const storage = createMemoryStorage();
        const entry = sampleEntry(group);
        await leaveCopy(storage, [group], [entry]);
        await createUserStorage(storage, TEST_USER.id).storage.set('tarja:group-outbox', [entry]);
        const api = createFakeApi();
        stubApi(api.handler);

        const { result } = renderLedgers({ storage, fakeAuth: createFakeAuth({ session: BEA }) });

        await waitFor(() => expect(api.requests).toContain('GET /api/groups'));
        expect(result.current.ledgers).toEqual([]);
        expect(result.current.outbox.getState().pending).toEqual([]);
        expect(api.requests.filter((request) => request.startsWith('PUT'))).toEqual([]);
        expect(await storage.get(`tarja:group-outbox:${TEST_USER.id}`)).toEqual([entry]);
    });
});

describe('useLedgers, with a closed group', () => {
    const closed = sampleGroup({ closed: 'deleted', name: 'Old trip' });

    function renderWithClient() {
        return renderAppHook(() => ({ ...useLedgers(), client: useQueryClient(), outbox: useGroupOutbox() }));
    }

    function entryRequests(api: ReturnType<typeof createFakeApi>, of: { id: string }) {
        return api.requests.filter((request) => request.startsWith(`GET /api/groups/${of.id}/entries`));
    }

    async function comeBack() {
        if (!vi.isFakeTimers()) vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 120_000);
        await act(async () => {
            focusManager.setFocused(false);
            focusManager.setFocused(true);
            onlineManager.setOnline(false);
            onlineManager.setOnline(true);
        });
    }

    it('asks once for its entries, and not again on focus or when the connection returns', async () => {
        const api = createFakeApi({ groups: [group, closed], entries: [sampleEntry(group), sampleEntry(closed)] });
        stubApi(api.handler);
        const { result } = renderWithClient();
        await waitFor(() => expect(result.current.ledgers.map((ledger) => ledger.hasData)).toEqual([true, true]));
        expect(entryRequests(api, closed)).toHaveLength(1);

        await comeBack();

        await waitFor(() => expect(entryRequests(api, group).length).toBeGreaterThan(1));
        expect(entryRequests(api, closed)).toHaveLength(1);
        expect(result.current.ledgers[1]!.entries.map((entry) => entry.text)).toEqual(['Dinner']);
    });

    it('asks for no entries on open when the device holds them from a pull made once it was closed', async () => {
        const first = createFakeApi({ groups: [group, closed], entries: [sampleEntry(closed)] });
        stubApi(first.handler);
        const storage = createMemoryStorage();
        const opened = renderAppHook(() => useLedgers(), { storage });
        await waitFor(() => expect(opened.result.current.ledgers[1]?.hasData).toBe(true));
        await waitFor(async () => expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined());
        opened.unmount();
        vi.unstubAllGlobals();
        const second = createFakeApi({ groups: [group, closed], entries: [sampleEntry(closed)] });
        stubApi(second.handler);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 120_000);

        const { result } = renderAppHook(() => useLedgers(), { storage });

        await waitFor(() => expect(entryRequests(second, group)).toHaveLength(1));
        expect(result.current.ledgers[1]!.entries).toHaveLength(1);
        expect(entryRequests(second, closed)).toEqual([]);
    });

    it('asks once more, on the next focus, for a group that closed after the last pull, then stops', async () => {
        const api = createFakeApi({ groups: [group, sampleGroup({ name: 'Porto' })], entries: [] });
        const porto = api.groups[1]!;
        stubApi(api.handler);
        const { result } = renderWithClient();
        await waitFor(() => expect(result.current.ledgers.map((ledger) => ledger.hasData)).toEqual([true, true]));
        expect(entryRequests(api, porto)).toHaveLength(1);

        api.serverWriteEntry(sampleEntry(porto, { text: 'Last one' }), porto.members[1]!.id);
        porto.closed = 'deleted';
        await act(() => result.current.client.invalidateQueries({ queryKey: ['groups'] }));
        await waitFor(() => expect(result.current.ledgers[1]!.group.closed).toBe('deleted'));
        expect(entryRequests(api, porto)).toHaveLength(1);

        await comeBack();
        await waitFor(() =>
            expect(result.current.ledgers[1]!.entries.map((entry) => entry.text)).toEqual(['Last one'])
        );
        await comeBack();

        await waitFor(() => expect(entryRequests(api, group).length).toBeGreaterThan(2));
        expect(entryRequests(api, porto)).toHaveLength(2);
    });

    it('keeps sending a write of the person waiting for a closed group', async () => {
        const api = createFakeApi({ groups: [group, closed], entries: [sampleEntry(closed)] });
        stubApi(api.handler);
        const { result } = renderWithClient();
        await waitFor(() => expect(result.current.ledgers[1]?.hasData).toBe(true));
        api.state.entryRefusal = { status: 503 };
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

        await act(() => result.current.outbox.put(sampleEntry(closed)));
        await act(() => vi.advanceTimersByTimeAsync(30_000));

        await vi.waitFor(() => expect(api.entryAttempts).toHaveLength(1));
    });
});

describe('useLedger', () => {
    function renderLedger(groupId: string) {
        return renderAppHook(() => ({ ledger: useLedger(groupId), outbox: useGroupOutbox() }));
    }

    it('reads one group and its entries, and asks for no other', async () => {
        const other = sampleGroup({ name: 'Porto' });
        const dinner = sampleEntry(group);
        const api = createFakeApi({ groups: [group, other], entries: [dinner] });
        stubApi(api.handler);

        const { result } = renderLedger(group.id);

        await waitFor(() => expect(result.current.ledger?.hasData).toBe(true));
        expect(result.current.ledger!.group).toEqual(group);
        expect(result.current.ledger!.entries.map((entry) => entry.id)).toEqual([dinner.id]);
        expect(api.requests.filter((request) => request.includes('/entries'))).toEqual([
            expect.stringContaining(`GET /api/groups/${group.id}/entries`),
        ]);
    });

    it('is nothing, and asks for nothing, for a group the device does not hold', async () => {
        const api = createFakeApi({ groups: [group] });
        stubApi(api.handler);

        const { result } = renderLedger(crypto.randomUUID());

        await waitFor(() => expect(api.requests).toContain('GET /api/groups'));
        expect(result.current.ledger).toBeUndefined();
        expect(api.requests.filter((request) => request.includes('/entries'))).toEqual([]);
    });

    it('tries a waiting write again every 30 s, with no other trigger', async () => {
        const api = createFakeApi({ groups: [group] });
        stubApi(api.handler);
        const { result } = renderLedger(group.id);
        await waitFor(() => expect(result.current.ledger?.hasData).toBe(true));
        api.state.entryRefusal = { status: 503 };
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

        await act(() => result.current.outbox.put(sampleEntry(group)));
        expect(api.entryAttempts).toHaveLength(0);
        await act(() => vi.advanceTimersByTimeAsync(30_000));
        await vi.waitFor(() => expect(api.entryAttempts).toHaveLength(1));
        api.state.entryRefusal = null;
        await act(() => vi.advanceTimersByTimeAsync(30_000));

        await vi.waitFor(() => expect(result.current.outbox.getState().pending).toEqual([]));
        expect(result.current.ledger!.entries).toHaveLength(1);
    });
});
