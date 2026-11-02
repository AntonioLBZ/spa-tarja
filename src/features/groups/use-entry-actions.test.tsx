import { onlineManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGroupOutbox } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderAppHook, stubApi } from '@/lib/test/render-app';

import { LocalRefusal } from './local-refusal';
import { useEntryActions } from './use-entry-actions';
import { useGroups, useLedgers } from './use-ledgers';

import type { SharedGroup } from '@core/shared-group';

async function setup(groups: SharedGroup[], options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi({ groups, ...options });
    stubApi(api.handler);
    const rendered = renderAppHook(() => ({
        actions: useEntryActions(),
        groups: useGroups().groups,
        ...useLedgers(),
        outbox: useGroupOutbox(),
    }));
    await waitFor(() =>
        expect(rendered.result.current.ledgers.map((ledger) => ledger.hasData)).toEqual(groups.map(() => true))
    );
    const ledgerOf = (groupId: string) =>
        rendered.result.current.ledgers.find((ledger) => ledger.group.id === groupId)!;
    const puts = () => api.requests.filter((request) => request.startsWith('PUT'));
    return { api, ...rendered, ledgerOf, puts };
}

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('writing an entry', () => {
    it('shows it in the ledger at once, keeps it on the device offline, and sends it once back online', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        onlineManager.setOnline(false);
        const { groupId, ...entry } = sampleEntry(group);

        await act(() => app.result.current.actions.save(groupId, entry));

        expect(app.ledgerOf(group.id).entries).toMatchObject([{ id: entry.id, text: 'Dinner' }]);
        expect(app.result.current.pendingIds.has(entry.id)).toBe(true);
        expect(app.result.current.outbox.getState().pending).toEqual([{ ...entry, groupId }]);
        expect(app.puts()).toEqual([]);

        onlineManager.setOnline(true);

        await waitFor(() => expect(app.result.current.outbox.getState().pending).toEqual([]));
        expect(app.puts()).toEqual([`PUT /api/groups/${group.id}/entries/${entry.id}`]);
        expect(app.api.entriesOf(group.id)).toMatchObject([{ id: entry.id, text: 'Dinner' }]);
    });

    it.each([
        ['a group that was deleted', sampleGroup({ closed: 'deleted' })],
        ['a group the person left', sampleGroup({ closed: 'left' })],
    ])('refuses a write to %s before it reaches the outbox', async (_, group) => {
        const app = await setup([group]);
        const { groupId, ...entry } = sampleEntry(group);

        const refused = app.result.current.actions.save(groupId, entry);

        await expect(refused).rejects.toBeInstanceOf(LocalRefusal);
        await expect(refused).rejects.toMatchObject({ code: 'read-only' });
        expect(app.result.current.outbox.getState().pending).toEqual([]);
        expect(app.puts()).toEqual([]);
    });

    it('refuses a write to a group the device does not hold', async () => {
        const app = await setup([]);
        const { groupId, ...entry } = sampleEntry(sampleGroup());

        await expect(app.result.current.actions.save(groupId, entry)).rejects.toMatchObject({ code: 'read-only' });
        expect(app.result.current.outbox.getState().pending).toEqual([]);
    });

    it('goes back to what the server keeps when it refuses an edit for good, and keeps why', async () => {
        const group = sampleGroup();
        const stored = sampleEntry(group);
        const app = await setup([group], { entries: [stored] });
        app.api.state.entryRefusal = { status: 422, error: 'clock-ahead' };
        const { groupId, ...entry } = stored;

        await act(() =>
            app.result.current.actions.save(groupId, { ...entry, text: 'From a clock ahead', updatedAt: 2 })
        );

        await waitFor(() => expect(app.result.current.outbox.getState().pending).toEqual([]));
        expect(app.result.current.outbox.getState().rejected).toMatchObject([
            { item: { id: stored.id, text: 'From a clock ahead' }, code: 'clock-ahead' },
        ]);
        expect(app.ledgerOf(group.id).entries).toMatchObject([{ id: stored.id, text: 'Dinner' }]);
    });

    it('turns a group read-only when a write finds it closed meanwhile', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        app.api.groups[0]!.closed = 'deleted';
        const { groupId, ...entry } = sampleEntry(group);

        await act(() => app.result.current.actions.save(groupId, entry));

        await waitFor(() => expect(app.ledgerOf(group.id).group.closed).toBe('deleted'));
        expect(app.result.current.outbox.getState().rejected).toMatchObject([{ code: 'closed' }]);
        expect(app.ledgerOf(group.id).entries).toEqual([]);
        await expect(app.result.current.actions.save(groupId, entry)).rejects.toMatchObject({ code: 'read-only' });
    });
});

describe('deleting an entry', () => {
    it('writes the delete, and Undo the entry again, each later than the version it replaces', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(1_000);
        const group = sampleGroup();
        const ahead = sampleEntry(group, { updatedAt: 5_000 });
        const app = await setup([group], { entries: [ahead] });
        const { groupId, ...entry } = ahead;

        const deleted = await act(() => app.result.current.actions.remove(groupId, entry));
        await waitFor(() => expect(app.api.entriesOf(group.id)).toMatchObject([{ deletedAt: 5_001 }]));
        await act(() => app.result.current.actions.restore(groupId, deleted));
        await waitFor(() => expect(app.api.entriesOf(group.id)).toMatchObject([{ deletedAt: null, updatedAt: 5_002 }]));

        expect(deleted).toMatchObject({ updatedAt: 5_001, deletedAt: 5_001 });
        expect(app.api.entryWrites).toHaveLength(2);
        await waitFor(() => expect(app.ledgerOf(group.id).entries).toMatchObject([{ id: ahead.id, deletedAt: null }]));
    });

    it('sends only the entry as it was when Undo comes while the delete is still waiting', async () => {
        const group = sampleGroup();
        const stored = sampleEntry(group);
        const app = await setup([group], { entries: [stored] });
        onlineManager.setOnline(false);
        const { groupId, ...entry } = stored;

        const deleted = await act(() => app.result.current.actions.remove(groupId, entry));
        expect(app.ledgerOf(group.id).entries).toMatchObject([{ id: stored.id, deletedAt: deleted.deletedAt }]);
        await act(() => app.result.current.actions.restore(groupId, deleted));
        onlineManager.setOnline(true);

        await waitFor(() => expect(app.result.current.outbox.getState().pending).toEqual([]));
        expect(app.api.entryAttempts).toMatchObject([{ id: stored.id, deletedAt: null }]);
        expect(app.api.entriesOf(group.id)).toMatchObject([{ id: stored.id, text: 'Dinner', deletedAt: null }]);
    });

    it('refuses to delete an entry of a closed group', async () => {
        const group = sampleGroup({ closed: 'deleted' });
        const stored = sampleEntry(group);
        const app = await setup([group], { entries: [stored] });
        const { groupId, ...entry } = stored;

        await expect(app.result.current.actions.remove(groupId, entry)).rejects.toMatchObject({ code: 'read-only' });
        expect(app.result.current.outbox.getState().pending).toEqual([]);
    });
});
