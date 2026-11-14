import { focusManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createFakeApi } from '@/lib/test/fake-api';
import { sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderAppHook, stubApi } from '@/lib/test/render-app';

import { WATCH_EVERY_MS, useGroupWatcher } from './group-watcher';

const group = sampleGroup();
const other = sampleGroup({ name: 'Porto' });
const closed = sampleGroup({ name: 'Old', closed: 'deleted' });
const bea = group.members[1]!.id;

function setup() {
    const api = createFakeApi({
        groups: [group, other, closed],
        entries: [sampleEntry(group), sampleEntry(other), sampleEntry(closed)],
    });
    stubApi(api.handler);
    renderAppHook(() => useGroupWatcher());
    const asked = (prefix: string) => api.requests.filter((request) => request.startsWith(prefix)).length;
    const listed = () => api.requests.filter((request) => request === 'GET /api/groups').length;
    return { api, asked, listed };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
});

afterEach(() => {
    focusManager.setFocused(undefined);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('useGroupWatcher', () => {
    it('asks for the groups once a minute while the page is in sight', async () => {
        const { listed } = setup();
        await waitFor(() => expect(listed()).toBe(1));

        await act(() => vi.advanceTimersByTimeAsync(WATCH_EVERY_MS));

        await waitFor(() => expect(listed()).toBe(2));
    });

    it('pulls the open groups whose cursor moved, and no other', async () => {
        const { api, asked } = setup();
        await waitFor(() => expect(asked(`GET /api/groups/${other.id}/entries`)).toBe(1));
        await waitFor(() => expect(asked(`GET /api/groups/${group.id}/entries`)).toBe(1));

        api.serverWriteEntry(sampleEntry(group), bea);
        await act(() => vi.advanceTimersByTimeAsync(WATCH_EVERY_MS));

        await waitFor(() => expect(asked(`GET /api/groups/${group.id}/entries?after=1`)).toBe(1));
        expect(asked(`GET /api/groups/${other.id}/entries`)).toBe(1);
        expect(asked(`GET /api/groups/${closed.id}/entries`)).toBe(0);
    });

    it('asks nothing while the page is hidden', async () => {
        const { listed } = setup();
        await waitFor(() => expect(listed()).toBe(1));

        act(() => focusManager.setFocused(false));
        await act(() => vi.advanceTimersByTimeAsync(WATCH_EVERY_MS * 3));

        expect(listed()).toBe(1);
    });
});
