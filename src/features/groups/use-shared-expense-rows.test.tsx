import { onlineManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGroupOutbox } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderAppHook, stubApi } from '@/lib/test/render-app';

import { useSharedExpenseRows } from './use-shared-expense-rows';

function renderRows(options: Parameters<typeof createFakeApi>[0]) {
    const api = createFakeApi(options);
    stubApi(api.handler);
    return { api, ...renderAppHook(() => ({ ...useSharedExpenseRows(), outbox: useGroupOutbox() })) };
}

afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('useSharedExpenseRows', () => {
    it('gives your part of the expenses of the groups that show in your expenses, closed ones too', async () => {
        const open = sampleGroup();
        const closed = sampleGroup({ closed: 'deleted' });
        const hidden = sampleGroup({ showInExpenses: false });
        const dinner = sampleEntry(open);
        const before = sampleEntry(closed, { text: 'Before it closed' });
        const { result } = renderRows({
            groups: [open, closed, hidden],
            entries: [
                dinner,
                sampleEntry(open, { text: 'Deleted', deletedAt: 2, updatedAt: 2 }),
                sampleEntry(hidden, { text: 'Not in my expenses' }),
                before,
            ],
        });

        await waitFor(() => expect(result.current.rows).toHaveLength(2));
        expect(result.current.rows.map((row) => [row.id, row.amountCents, row.shared.groupId])).toEqual([
            [dinner.id, 2000, open.id],
            [before.id, 2000, closed.id],
        ]);
    });

    it('reads a share of a dummy merged into you as yours', async () => {
        const group = sampleGroup();
        const dummy = person('Ana from before', { claimed: false, mergedInto: group.me, leftAt: 1 });
        group.members.push(dummy);
        const entry = sampleEntry(group, {
            paidBy: group.members[1]!.id,
            shares: [
                { memberId: group.members[1]!.id, cents: 1000 },
                { memberId: dummy.id, cents: 3000 },
            ],
        });
        const { result } = renderRows({ groups: [group], entries: [entry] });

        await waitFor(() => expect(result.current.rows).toHaveLength(1));
        expect(result.current.rows[0]).toMatchObject({ id: entry.id, amountCents: 3000 });
    });

    it('takes in at once an expense written while offline', async () => {
        const group = sampleGroup();
        const { api, result } = renderRows({ groups: [group] });
        await waitFor(() => expect(api.requests).toContain(`GET /api/groups/${group.id}/entries?after=0`));
        onlineManager.setOnline(false);

        const entry = sampleEntry(group, { text: 'Offline dinner' });
        await act(() => result.current.outbox.put(entry));

        expect(result.current.rows).toMatchObject([{ id: entry.id, text: 'Offline dinner', amountCents: 2000 }]);
    });

    it('says which group and entry each row is from, also once the entry is deleted', async () => {
        const group = sampleGroup();
        const entry = sampleEntry(group);
        const { result } = renderRows({ groups: [group], entries: [entry] });
        await waitFor(() => expect(result.current.rows).toHaveLength(1));
        onlineManager.setOnline(false);

        await act(() => result.current.outbox.put({ ...entry, updatedAt: 2, deletedAt: 2 }));

        expect(result.current.rows).toEqual([]);
        expect(result.current.sourceOf(entry.id)).toMatchObject({
            group: { ...group, seq: 1 },
            entry: { id: entry.id, deletedAt: 2 },
        });
        expect(result.current.pendingIds.has(entry.id)).toBe(true);
    });

    it('syncs the groups that show in your expenses and those with a write waiting, and no other', async () => {
        const shown = sampleGroup();
        const hidden = sampleGroup({ showInExpenses: false });
        const { api, result } = renderRows({ groups: [shown, hidden] });
        await waitFor(() => expect(api.requests).toContain(`GET /api/groups/${shown.id}/entries?after=0`));
        const asked = (group: { id: string }) =>
            api.requests.filter((request) => request.includes(`/api/groups/${group.id}/entries`));
        expect(asked(hidden)).toEqual([]);

        await act(() => result.current.outbox.put(sampleEntry(hidden)));

        await waitFor(() => expect(result.current.outbox.getState().pending).toEqual([]));
        expect(asked(hidden)).toEqual([expect.stringMatching(/^PUT /), `GET /api/groups/${hidden.id}/entries?after=0`]);
        expect(result.current.rows).toEqual([]);
    });
});
