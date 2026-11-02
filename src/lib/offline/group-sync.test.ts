import { QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GROUPS_KEY, deleteMember, groupEntriesKey, groupsQuery, type GroupEntriesState } from '@/lib/api';
import { createQueryClient } from '@/lib/query-client';
import { createFakeApi } from '@/lib/test/fake-api';
import { sampleEntry, sampleGroup } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { stubApi } from '@/lib/test/render-app';

import { groupEntriesQuery, syncGroup } from './group-sync';
import { GROUP_OUTBOX_STORAGE_KEY, createOutbox, type PendingEntry } from './outbox';

import type { SharedGroup } from '@core/shared-group';

const group = sampleGroup();
const other = sampleGroup();
const bea = group.members[1]!.id;

function setup(options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi({ groups: [group, other], ...options });
    stubApi(api.handler);
    const client = createQueryClient();
    client.setQueryData(GROUPS_KEY, structuredClone(api.groups));
    const outbox = createOutbox<PendingEntry>(createMemoryStorage(), GROUP_OUTBOX_STORAGE_KEY);

    const sync = (groupId = group.id) => client.fetchQuery({ ...groupEntriesQuery(outbox, groupId), staleTime: 0 });
    const cached = (groupId = group.id) => client.getQueryData<GroupEntriesState>(groupEntriesKey(groupId));
    const cachedGroup = () => client.getQueryData<SharedGroup[]>(GROUPS_KEY)?.find((item) => item.id === group.id);
    const ids = (entries: ReadonlyArray<{ id: string }>) => entries.map((entry) => entry.id);

    return { api, client, outbox, sync, cached, cachedGroup, ids };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('pulling a group', () => {
    it('loads the whole group on the first sync, by its own cursor', async () => {
        const [a, b] = [sampleEntry(group), sampleEntry(group)];
        const { ids, sync } = setup({ entries: [a, sampleEntry(other), b] });

        const state = await sync();

        expect(ids(state.entries)).toEqual([a.id, b.id]);
        expect(state.cursor).toBe(2);
    });

    it('asks only for what changed after its cursor and merges it, edits and deletes of others included', async () => {
        const [a, b] = [sampleEntry(group), sampleEntry(group)];
        const { api, sync } = setup({ entries: [a, b] });
        await sync();

        api.serverWriteEntry({ ...a, text: 'Edited', updatedAt: 2 }, bea);
        api.serverWriteEntry({ ...b, deletedAt: 3, updatedAt: 3 }, bea);
        const state = await sync();

        expect(api.requests.at(-1)).toBe(`GET /api/groups/${group.id}/entries?after=2`);
        expect(state.entries.map((entry) => [entry.text, entry.deletedAt, entry.updatedBy])).toEqual([
            ['Edited', null, bea],
            ['Dinner', 3, bea],
        ]);
        expect(state.cursor).toBe(4);
    });

    it('follows the pages until the server has no more', async () => {
        const entries = Array.from({ length: 5 }, () => sampleEntry(group));
        const { sync } = setup({ entries, pageSize: 2 });

        const state = await sync();

        expect(state.entries).toHaveLength(5);
        expect(state.cursor).toBe(5);
    });

    it('keeps the copy of a group the person left, and never takes an edit made after', async () => {
        const entry = sampleEntry(group);
        const { api, cached, sync } = setup({ entries: [entry] });
        await sync();

        await deleteMember(group.id, group.me);
        api.serverWriteEntry({ ...entry, text: 'Edited after', updatedAt: 2 }, bea);
        await sync();

        expect(cached()?.entries.map((item) => item.text)).toEqual(['Dinner']);
    });
});

describe('pushing the entries of a group', () => {
    it("sends the group's pending entries in the order they were saved, before pulling, and keeps the others", async () => {
        const [a, b, c, elsewhere] = [sampleEntry(group), sampleEntry(group), sampleEntry(group), sampleEntry(other)];
        const { api, cached, ids, outbox, sync } = setup();
        await outbox.put(a);
        await outbox.put(elsewhere);
        await outbox.put(b);
        await outbox.put(c);

        await sync();

        expect(ids(api.entryAttempts)).toEqual([a.id, b.id, c.id]);
        expect(ids(outbox.getState().pending)).toEqual([elsewhere.id]);
        expect(cached()?.entries).toEqual(api.entriesOf(group.id));
        expect(cached()?.entries.map((entry) => entry.updatedBy)).toEqual([group.me, group.me, group.me]);
    });

    it('keeps a sent entry on the device when the pull after it fails, in a group never pulled before', async () => {
        const entry = sampleEntry(group);
        const { api, cached, ids, outbox, sync } = setup();
        stubApi((url, init) => {
            if (url.pathname.endsWith('/entries') && (init?.method ?? 'GET') === 'GET')
                throw new TypeError('Failed to fetch');
            return api.handler(url, init);
        });
        await outbox.put(entry);

        await expect(sync()).rejects.toThrow('Failed to fetch');

        expect(outbox.getState().pending).toEqual([]);
        expect(ids(cached()!.entries)).toEqual([entry.id]);
        expect(cached()?.cursor).toBe(0);
    });

    it('changes nothing when the same write is sent twice', async () => {
        const entry = sampleEntry(group);
        const { api, cached, outbox, sync } = setup();
        await outbox.put(entry);
        await sync();

        await outbox.put(entry);
        await sync();

        expect(api.entriesOf(group.id)).toHaveLength(1);
        expect(api.cursorOf(group.id)).toBe(1);
        expect(cached()?.entries).toHaveLength(1);
        expect(outbox.getState()).toEqual({ pending: [], rejected: [] });
    });

    it('sends again a write whose answer was lost, without a duplicate, and keeps the rest waiting in order', async () => {
        const [a, b, c] = [sampleEntry(group), sampleEntry(group), sampleEntry(group)];
        const { api, cached, ids, outbox, sync } = setup();
        await outbox.putAll([a, b, c]);
        api.state.loseEntryAnswers = true;

        await expect(sync()).rejects.toThrow();
        expect(ids(api.entriesOf(group.id))).toEqual([a.id]);
        expect(ids(outbox.getState().pending)).toEqual([a.id, b.id, c.id]);

        api.state.loseEntryAnswers = false;
        await sync();

        expect(ids(api.entryAttempts)).toEqual([a.id, a.id, b.id, c.id]);
        expect(ids(api.entriesOf(group.id))).toEqual([a.id, b.id, c.id]);
        expect(api.cursorOf(group.id)).toBe(3);
        expect(ids(cached()!.entries)).toEqual([a.id, b.id, c.id]);
        expect(outbox.getState().pending).toEqual([]);
    });

    it.each([
        ['the server is failing', { status: 503 }],
        ['the session has ended', { status: 401, error: 'unauthorized' }],
    ])('keeps everything pending, in order, when %s', async (_, refusal) => {
        const [a, b] = [sampleEntry(group), sampleEntry(group)];
        const { api, ids, outbox, sync } = setup();
        api.state.entryRefusal = refusal;
        await outbox.putAll([a, b]);

        await expect(sync()).rejects.toMatchObject({ status: refusal.status });

        expect(ids(api.entryAttempts)).toEqual([a.id]);
        expect(ids(outbox.getState().pending)).toEqual([a.id, b.id]);
        expect(outbox.getState().rejected).toEqual([]);
    });

    it('keeps everything pending when the connection is down, and delivers it once it is back', async () => {
        const entry = sampleEntry(group);
        const { api, ids, outbox, sync } = setup();
        api.state.offline = true;
        await outbox.put(entry);
        await expect(sync()).rejects.toThrow();
        expect(ids(outbox.getState().pending)).toEqual([entry.id]);

        api.state.offline = false;
        await sync();

        expect(outbox.getState().pending).toEqual([]);
        expect(ids(api.entriesOf(group.id))).toEqual([entry.id]);
    });

    it.each([
        [400, 'invalid'],
        [400, 'unknown-category'],
        [403, 'not-owner'],
        [404, 'not-found'],
        [409, 'id-taken'],
        [422, 'clock-ahead'],
        [422, 'member-left'],
        [422, 'unknown-member'],
        [422, 'not-the-payer'],
        [422, 'kind-fixed'],
        [422, 'currency-mismatch'],
    ])('drops a write refused with %i %s, keeps why, and goes back to the stored version', async (status, error) => {
        const stored = sampleEntry(group);
        const edit = { ...stored, text: 'Edited here', updatedAt: 2 };
        const { api, cached, outbox, sync } = setup({ entries: [stored] });
        await sync();
        await outbox.put(edit);
        api.state.entryRefusal = { status, error };

        await sync();

        expect(outbox.getState()).toEqual({ pending: [], rejected: [{ item: edit, code: error }] });
        expect(cached()?.entries.map((entry) => entry.text)).toEqual(['Dinner']);
    });

    it('drops a write whose id belongs to another group and carries on with the rest', async () => {
        const taken = sampleEntry(other);
        const good = sampleEntry(group);
        const { api, ids, outbox, sync } = setup({ entries: [taken] });
        const before = api.entriesOf(other.id);
        await outbox.putAll([{ ...taken, groupId: group.id, text: 'Moved' }, good]);

        await sync();

        expect(outbox.getState().rejected.map((rejection) => rejection.code)).toEqual(['id-taken']);
        expect(ids(api.entriesOf(group.id))).toEqual([good.id]);
        expect(api.entriesOf(other.id)).toEqual(before);
    });

    it('marks the group closed when a write finds it closed, and asks the server which way', async () => {
        const entry = sampleEntry(group);
        const { api, cachedGroup, client, outbox, sync } = setup();
        const observer = new QueryObserver(client, { ...groupsQuery(), staleTime: Infinity });
        const unsubscribe = observer.subscribe(() => undefined);
        api.groups[0]!.closed = 'left';
        await outbox.put(entry);

        await sync();

        expect(outbox.getState().rejected).toEqual([{ item: entry, code: 'closed' }]);
        expect(cachedGroup()?.closed).toBe('left');
        unsubscribe();
    });

    it('marks the group closed at once, even when the rest of the push then fails', async () => {
        const [first, second] = [sampleEntry(group), sampleEntry(group)];
        const { api, cachedGroup, outbox, sync } = setup();
        api.groups[0]!.closed = 'deleted';
        let writes = 0;
        stubApi((url, init) => {
            if (init?.method === 'PUT' && ++writes > 1) throw new TypeError('Failed to fetch');
            return api.handler(url, init);
        });
        await outbox.putAll([first, second]);

        await expect(sync()).rejects.toThrow('Failed to fetch');

        expect(outbox.getState().rejected).toEqual([{ item: first, code: 'closed' }]);
        expect(cachedGroup()?.closed).not.toBeNull();
    });

    it('marks the group closed on the device before the server says which way', async () => {
        const entry = sampleEntry(group);
        const { api, cachedGroup, outbox, sync } = setup();
        api.groups[0]!.closed = 'deleted';
        await outbox.put(entry);

        await sync();

        expect(cachedGroup()?.closed).not.toBeNull();
    });

    it('does not send a write twice when two syncs of the group overlap', async () => {
        const { api, client, outbox } = setup();
        await outbox.put(sampleEntry(group));

        await Promise.all([syncGroup(client, outbox, group.id), syncGroup(client, outbox, group.id)]);

        expect(api.entryAttempts).toHaveLength(1);
    });

    it('leaves a write made while a pull was on its way in the outbox, so it still wins', async () => {
        const entry = sampleEntry(group);
        const { api, cached, outbox, sync } = setup({ entries: [entry] });
        await sync();
        const release = api.hold();
        const pulling = sync();
        await vi.waitFor(() => expect(api.requests.at(-1)).toBe(`GET /api/groups/${group.id}/entries?after=1`));

        const mine = { ...entry, text: 'Mine', updatedAt: 5 };
        await outbox.put(mine);
        api.serverWriteEntry({ ...entry, text: 'Older', updatedAt: 3 }, bea);
        release();
        await pulling;

        expect(outbox.getState().pending).toEqual([mine]);
        await sync();
        expect(api.entriesOf(group.id).map((item) => item.text)).toEqual(['Mine']);
        expect(cached()?.entries.map((item) => item.text)).toEqual(['Mine']);
        expect(outbox.getState().pending).toEqual([]);
    });
});
