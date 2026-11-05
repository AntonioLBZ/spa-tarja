import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { PendingEntry } from '@/lib/offline';
import type { SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const refused = en.groups.refused;

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');

function group(name: string) {
    return sampleGroup({ name, members: [ana, bea], me: ana.id });
}

function said(name: string, groupName: string, reason: string) {
    return `${t('groups.refused.change', { name, group: groupName })} ${reason}`;
}

// Opens a screen and has the server refuse the writes given, sent as soon as the screen syncs their group
async function refuse(path: string, groups: SharedGroup[], writes: PendingEntry[], code: string | null, status = 422) {
    const api = createFakeApi({ groups });
    api.state.entryRefusal = code === null ? { status } : { status, error: code };
    stubApi(api.handler);
    const app = renderApp({ path });
    await screen.findByRole('heading', { level: 1 });
    await act(async () => {
        await app.groupOutbox.putAll(writes);
        for (const { id } of groups) await app.queryClient.invalidateQueries({ queryKey: groupEntriesKey(id) });
    });
    await waitFor(() => expect(app.groupOutbox.getState().pending).toEqual([]));
    return { api, app };
}

afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
});

describe('a write the server refused for good', () => {
    it.each([
        ['closed', 409, refused.reason.closed],
        ['member-left', 422, refused.reason.memberLeft],
        ['unknown-member', 422, refused.reason.unknownMember],
        ['not-the-payer', 422, refused.reason.notThePayer],
        ['kind-fixed', 422, refused.reason.kindFixed],
        ['currency-mismatch', 422, refused.reason.currencyMismatch],
        ['unknown-category', 400, refused.reason.unknownCategory],
        ['id-taken', 409, refused.reason.idTaken],
        ['clock-ahead', 422, refused.reason.clockAhead],
        [null, 400, refused.reason.other],
    ])('is said in words, with the entry, the group and why (%s)', async (code, status, reason) => {
        const trip = group('Trip');
        await refuse(`/groups/${trip.id}`, [trip], [sampleEntry(trip, { text: 'Dinner' })], code, status);

        expect((await screen.findByText(said('Dinner', 'Trip', reason))).getAttribute('role')).toBe('alert');
    });

    it('names a settlement by who paid whom, and an expense with no text by its category', async () => {
        const trip = group('Trip');
        const settlement = sampleSettlement(trip, ana.id, bea.id, 500);
        await refuse(`/groups/${trip.id}`, [trip], [settlement, sampleEntry(trip, { text: '' })], 'member-left');

        const paid = t('groups.ledger.youPaidTo', { name: 'Bea' });
        expect(await screen.findByText(said(paid, 'Trip', refused.reason.memberLeft))).toBeDefined();
        expect(screen.getByText(said(en.categories.food, 'Trip', refused.reason.memberLeft))).toBeDefined();
    });

    it('goes away with its own Dismiss, the others staying', async () => {
        const trip = group('Trip');
        await refuse(
            `/groups/${trip.id}`,
            [trip],
            [sampleEntry(trip, { text: 'Dinner' }), sampleEntry(trip, { text: 'Taxi' })],
            'closed',
            409
        );
        const dinner = said('Dinner', 'Trip', refused.reason.closed);
        await screen.findByText(dinner);

        fireEvent.click(screen.getByRole('button', { name: refused.dismiss, description: dinner }));

        expect(screen.queryByText(dinner)).toBeNull();
        expect(screen.getByText(said('Taxi', 'Trip', refused.reason.closed))).toBeDefined();
    });

    it('shows on the screen of its group only, and every one on the Groups tab and at home', async () => {
        const trip = group('Trip');
        const rome = group('Rome');
        const writes = [sampleEntry(trip, { text: 'Dinner' }), sampleEntry(rome, { text: 'Pizza' })];
        await refuse('/groups', [trip, rome], writes, 'member-left');
        const dinner = said('Dinner', 'Trip', refused.reason.memberLeft);
        const pizza = said('Pizza', 'Rome', refused.reason.memberLeft);

        expect(await screen.findByText(dinner)).toBeDefined();
        expect(screen.getByText(pizza)).toBeDefined();

        fireEvent.click(screen.getByRole('link', { name: /^Trip/ }));
        await screen.findByRole('heading', { level: 1, name: 'Trip' });
        expect(screen.getByText(dinner)).toBeDefined();
        expect(screen.queryByText(pizza)).toBeNull();

        fireEvent.click(screen.getAllByRole('link', { name: en.nav.expenses })[0]!);
        expect(await screen.findByText(pizza)).toBeDefined();
        expect(screen.getByText(dinner)).toBeDefined();
    });

    it('speaks Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const tEs = createTranslator({ locale: 'es', messages: es });
        const trip = group('Viaje');
        await refuse(`/groups/${trip.id}`, [trip], [sampleEntry(trip, { text: 'Cena' })], 'clock-ahead');

        const message = `${tEs('groups.refused.change', { name: 'Cena', group: 'Viaje' })} ${es.groups.refused.reason.clockAhead}`;
        expect(await screen.findByText(message)).toBeDefined();
        expect(screen.getByRole('button', { name: es.groups.refused.dismiss })).toBeDefined();
    });
});
