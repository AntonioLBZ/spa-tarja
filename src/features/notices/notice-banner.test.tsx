import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { WATCH_EVERY_MS } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';

const t = createTranslator({ locale: 'en', messages: en, namespace: 'notices' });

const flat = sampleGroup({ name: 'Flat' });
const bea = flat.members[1]!.id;

async function open(path = '/') {
    const api = createFakeApi({ groups: [flat], entries: [sampleEntry(flat)] });
    stubApi(api.handler);
    const app = renderApp({ path });
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    await waitFor(() => expect(app.queryClient.getQueryData(groupEntriesKey(flat.id))).toBeDefined());
    return { api, app };
}

async function nextWatch() {
    await act(() => vi.advanceTimersByTimeAsync(WATCH_EVERY_MS));
}

function banner() {
    return document.querySelector('.banner');
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'], shouldAdvanceTime: true });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('NoticeBanner', () => {
    it('tells in a banner an expense somebody else added with the person', async () => {
        const { api } = await open();

        api.serverWriteEntry({ ...sampleEntry(flat), text: 'Pizza' }, bea);
        await nextWatch();

        const message = t('expense', { actor: 'Bea', text: 'Pizza', part: '€20.00' });
        await waitFor(() => expect(banner()?.textContent).toContain(message));
        expect(banner()?.textContent).toContain('Flat');
    });

    it('opens the group when it is pressed', async () => {
        const { api } = await open();
        api.serverWriteEntry({ ...sampleEntry(flat), text: 'Pizza' }, bea);
        await nextWatch();
        await waitFor(() => expect(banner()).not.toBeNull());

        fireEvent.click(document.querySelector<HTMLElement>('.banner__open')!);

        expect(await screen.findByRole('heading', { name: 'Flat', level: 1 })).toBeTruthy();
    });

    it('adds what comes while it shows to the same banner', async () => {
        const { api } = await open();
        api.serverWriteEntry(sampleEntry(flat), bea);
        await nextWatch();
        await waitFor(() => expect(banner()).not.toBeNull());

        api.serverWriteEntry(sampleEntry(flat), bea);
        await nextWatch();

        await waitFor(() => expect(banner()?.textContent).toContain(t('expenses', { count: 2 })));
    });

    it('tells nothing of the group whose screen is showing', async () => {
        const { api } = await open(`/groups/${flat.id}`);

        api.serverWriteEntry({ ...sampleEntry(flat), text: 'Pizza' }, bea);
        await nextWatch();

        await screen.findByText('Pizza');
        expect(banner()).toBeNull();
    });

    it('tells nothing of an entry of the person, made on another device', async () => {
        const { api } = await open();

        api.serverWriteEntry({ ...sampleEntry(flat), text: 'Pizza' }, flat.me);
        await nextWatch();
        await waitFor(() => expect(api.requests.some((request) => request.includes('entries?after=1'))).toBe(true));

        expect(banner()).toBeNull();
    });
});
