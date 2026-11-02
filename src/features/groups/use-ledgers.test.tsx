import { QueryClient, dehydrate, onlineManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { PERSIST_BUSTER, createPersister, createUserStorage, useGroupOutbox } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER, createFakeAuth } from '@/lib/test/fake-auth';
import { sampleEntry, sampleGroup } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderAppHook, stubApi } from '@/lib/test/render-app';

import { useLedgers } from './use-ledgers';

import type { AuthUser } from '@/lib/auth';
import type { PendingEntry } from '@/lib/offline';
import type { SharedGroup } from '@core/shared-group';

const BEA: AuthUser = { id: 'user-bea', name: 'Bea Ruiz', email: 'bea@example.com' };

const group = sampleGroup();
const bea = group.members[1]!.id;

// What the device kept of the groups the last time the user had the app open
async function leaveCopy(
    storage: ReturnType<typeof createMemoryStorage>,
    groups: SharedGroup[],
    entries: PendingEntry[]
) {
    const source = new QueryClient();
    source.setQueryData(GROUPS_KEY, groups);
    for (const item of groups) {
        const own = entries.filter((entry) => entry.groupId === item.id);
        source.setQueryData(groupEntriesKey(item.id), {
            entries: own.map((entry) => ({ ...entry, createdBy: item.me, updatedBy: item.me })),
            cursor: own.length,
        });
    }
    await createPersister(createUserStorage(storage, TEST_USER.id).storage).persistClient({
        timestamp: Date.now(),
        buster: PERSIST_BUSTER,
        clientState: dehydrate(source),
    });
}

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
