import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { TEST_USER } from '@/lib/testing/fake-auth';
import { person, sampleEntry, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { chosenOption, pickOption } from '@/lib/testing/select';
import { openAddSheet } from '@/lib/testing/sheet';
import { stubViewport } from '@/lib/testing/viewport';
import { MAX_PINNED_GROUPS } from '@core/shared-group';

import type { SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');

const named = (name: string, overrides: Partial<SharedGroup> = {}) => {
    return sampleGroup({ name, members: [ana, bea], me: ana.id, ...overrides });
};

const open = async (path: string, groups: SharedGroup[], entries: ReturnType<typeof sampleEntry>[] = []) => {
    const api = createFakeApi({ groups, entries });
    stubApi(api.handler);
    const app = renderApp({ path });
    await screen.findAllByRole('button', { name: en.nav.add });
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    return { api, app };
};

const tabs = () => screen.getByRole('navigation', { name: en.expenses.list.tabs });

const tab = (name: string) => within(tabs()).getByRole('link', { name });

const pinButton = (name: string) => screen.getByRole('button', { name: t('groups.row.pin', { name }) });

const pinFull = t('groups.edit.pinFull', { max: MAX_PINNED_GROUPS });

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
});

describe('the tabs of the Expenses screen', () => {
    it('are not there while nothing is pinned, and the title is Expenses', async () => {
        await open('/', [named('Trip')]);

        expect(screen.queryByRole('navigation', { name: en.expenses.list.tabs })).toBeNull();
    });

    it('put Expenses first and the pinned open groups after it, in the order they were pinned', async () => {
        await open('/', [
            named('Flat', { pinnedAt: 2_000 }),
            named('Trip', { pinnedAt: 1_000 }),
            named('Gone', { pinnedAt: 500, closed: 'deleted' }),
            named('Other'),
        ]);

        const names = await waitFor(() => within(tabs()).getAllByRole('link'));

        expect(names.map((link) => link.textContent)).toEqual([en.expenses.list.title, 'Trip', 'Flat']);
        expect(tab(en.expenses.list.title).getAttribute('aria-current')).toBe('page');
    });

    it('show the group as its own screen, and the plus starts an expense in it', async () => {
        await open('/', [named('Trip', { pinnedAt: 1_000 })]);

        fireEvent.click(await waitFor(() => tab('Trip')));

        const edit = await screen.findByRole('link', { name: en.groups.edit.link });
        expect(edit.parentElement?.classList.contains('group-screen')).toBe(true);
        expect(edit.parentElement?.lastElementChild).toBe(edit);
        expect(tab('Trip').getAttribute('aria-current')).toBe('page');
        expect(tab(en.expenses.list.title).getAttribute('aria-current')).toBeNull();
        await openAddSheet();
        expect(chosenOption(en.groups.share.with)).toBe('Trip');
    });

    it('start each group with its own search and filters, none carried over from the tab before', async () => {
        const trip = named('Trip', { pinnedAt: 1_000 });
        const flat = named('Flat', { pinnedAt: 2_000 });
        await open('/', [trip, flat], [sampleEntry(trip, { text: 'Dinner' }), sampleEntry(flat, { text: 'Rent' })]);
        const filters = (count: number) =>
            screen.findByRole('button', { name: t('groups.ledger.filters.toggle', { count }) });

        fireEvent.click(await waitFor(() => tab('Trip')));
        fireEvent.click(await filters(0));
        pickOption(en.groups.ledger.filters.kind, en.groups.ledger.filters.kinds.settlement);
        expect(await filters(1)).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: en.expenses.filters.close }));

        fireEvent.click(tab('Flat'));
        expect(await screen.findByText('Rent', { selector: '.expense-item__text' })).toBeDefined();
        expect(await filters(0)).toBeDefined();
    });

    it('go back to Expenses for a group that is not pinned', async () => {
        const trip = named('Trip', { pinnedAt: 1_000 });
        const other = named('Other');
        await open(`/?group=${other.id}`, [trip, other]);

        await waitFor(() => expect(tab(en.expenses.list.title).getAttribute('aria-current')).toBe('page'));
        expect(screen.queryByRole('link', { name: en.groups.edit.link })).toBeNull();
    });

    it('are swiped through on a phone before Groups', async () => {
        stubViewport(false);
        await open('/', [named('Trip', { pinnedAt: 1_000 })]);
        await waitFor(() => tab('Trip'));
        const swipe = () => {
            const main = document.querySelector('main')!;
            const init = { bubbles: true, isPrimary: true, pointerId: 1, pointerType: 'touch', clientY: 300 };
            main.dispatchEvent(new PointerEvent('pointerdown', { ...init, clientX: 600 }));
            main.dispatchEvent(new PointerEvent('pointerup', { ...init, clientX: 200 }));
        };

        act(swipe);
        await waitFor(() => expect(tab('Trip').getAttribute('aria-current')).toBe('page'));

        act(swipe);
        expect(await screen.findByRole('heading', { level: 1, name: en.groups.title })).toBeDefined();
    });
});

describe('the tab the Expenses screen opens on', () => {
    it('is the one shown last on this device', async () => {
        const trip = named('Trip', { pinnedAt: 1_000 });
        const { app } = await open('/', [trip]);
        fireEvent.click(await waitFor(() => tab('Trip')));
        await waitFor(() => expect(tab('Trip').getAttribute('aria-current')).toBe('page'));
        app.unmount();

        const again = await open('/', [trip]);

        await waitFor(() => expect(tab('Trip').getAttribute('aria-current')).toBe('page'));
        expect(again.app.router.state.location.search).toEqual({ group: trip.id });
    });

    it('leaves the Expenses tab leading to Expenses once opened', async () => {
        const trip = named('Trip', { pinnedAt: 1_000 });
        localStorage.setItem(`tarja:home-tab:${TEST_USER.id}`, trip.id);
        await open('/', [trip]);
        await waitFor(() => expect(tab('Trip').getAttribute('aria-current')).toBe('page'));

        fireEvent.click(tab(en.expenses.list.title));

        await waitFor(() => expect(tab(en.expenses.list.title).getAttribute('aria-current')).toBe('page'));
        expect(localStorage.getItem(`tarja:home-tab:${TEST_USER.id}`)).toBeNull();
    });

    it('is where the logo and Expenses in the bar lead back to', async () => {
        const trip = named('Trip', { pinnedAt: 1_000 });
        const { app } = await open('/', [trip]);
        fireEvent.click(await waitFor(() => tab('Trip')));
        await waitFor(() => expect(tab('Trip').getAttribute('aria-current')).toBe('page'));

        fireEvent.click(screen.getByRole('link', { name: en.nav.groups }));
        await waitFor(() => expect(app.router.state.location.pathname).toBe('/groups'));
        fireEvent.click(screen.getByRole('link', { name: en.nav.expenses }));

        await waitFor(() => expect(tab('Trip').getAttribute('aria-current')).toBe('page'));

        fireEvent.click(screen.getByRole('link', { name: en.nav.groups }));
        await waitFor(() => expect(app.router.state.location.pathname).toBe('/groups'));
        fireEvent.click(screen.getByRole('link', { name: 'Tarja' }));

        await waitFor(() => expect(tab('Trip').getAttribute('aria-current')).toBe('page'));
    });

    it('is Expenses from the logo once the Expenses tab was shown', async () => {
        const trip = named('Trip', { pinnedAt: 1_000 });
        const { app } = await open(`/?group=${trip.id}`, [trip]);
        await waitFor(() => expect(tab('Trip').getAttribute('aria-current')).toBe('page'));
        fireEvent.click(tab(en.expenses.list.title));
        await waitFor(() => expect(tab(en.expenses.list.title).getAttribute('aria-current')).toBe('page'));

        fireEvent.click(screen.getByRole('link', { name: en.nav.groups }));
        await waitFor(() => expect(app.router.state.location.pathname).toBe('/groups'));
        fireEvent.click(screen.getByRole('link', { name: 'Tarja' }));

        await waitFor(() => expect(tab(en.expenses.list.title).getAttribute('aria-current')).toBe('page'));
        expect(app.router.state.location.search).toEqual({});
    });

    it('is Expenses when the group shown last is no longer pinned', async () => {
        const trip = named('Trip', { pinnedAt: 1_000 });
        localStorage.setItem(`tarja:home-tab:${TEST_USER.id}`, named('Other').id);
        await open('/', [trip]);

        await waitFor(() => expect(tab(en.expenses.list.title).getAttribute('aria-current')).toBe('page'));
    });
});

describe('the pin of a group in Groups', () => {
    it('pins an open group to Expenses, and unpins it', async () => {
        await open('/groups', [named('Trip')]);

        fireEvent.click(await waitFor(() => pinButton('Trip')));

        await waitFor(() => expect(pinButton('Trip').getAttribute('aria-pressed')).toBe('true'));
        fireEvent.click(pinButton('Trip'));
        await waitFor(() => expect(pinButton('Trip').getAttribute('aria-pressed')).toBe('false'));
    });

    it('turns off the other pins once two are pinned, and says why', async () => {
        await open('/groups', [named('Trip', { pinnedAt: 1_000 }), named('Flat', { pinnedAt: 2_000 }), named('Car')]);

        await waitFor(() => expect((pinButton('Car') as HTMLButtonElement).disabled).toBe(true));
        expect((pinButton('Trip') as HTMLButtonElement).disabled).toBe(false);
        expect(screen.getByText(pinFull)).toBeTruthy();
    });

    it('is off with no connection', async () => {
        await open('/groups', [named('Trip')]);
        await waitFor(() => pinButton('Trip'));

        onlineManager.setOnline(false);

        await waitFor(() => expect((pinButton('Trip') as HTMLButtonElement).disabled).toBe(true));
    });

    it('is not offered for a closed group', async () => {
        await open('/groups', [named('Trip', { closed: 'deleted' })]);
        await screen.findByRole('button', { name: en.groups.lists.closed });

        expect(screen.queryByRole('button', { name: t('groups.row.pin', { name: 'Trip' }) })).toBeNull();
    });
});

describe('Pin to Expenses in the settings of a group', () => {
    it('pins the group', async () => {
        const trip = named('Trip');
        await open(`/groups/${trip.id}/edit`, [trip]);

        const box = (await screen.findByRole('checkbox', { name: en.groups.edit.pin })) as HTMLInputElement;
        fireEvent.click(box);

        await waitFor(() => expect(box.checked).toBe(true));
    });

    it('is off with two others pinned, and says why', async () => {
        const car = named('Car');
        await open(`/groups/${car.id}/edit`, [
            named('Trip', { pinnedAt: 1_000 }),
            named('Flat', { pinnedAt: 2_000 }),
            car,
        ]);

        const box = (await screen.findByRole('checkbox', { name: en.groups.edit.pin })) as HTMLInputElement;

        expect(box.disabled).toBe(true);
        expect(screen.getByText(pinFull)).toBeTruthy();
    });

    it('is not there for a closed group', async () => {
        const trip = named('Trip', { closed: 'left' });
        await open(`/groups/${trip.id}/edit`, [trip]);
        await screen.findByRole('checkbox', { name: en.groups.edit.show });

        expect(screen.queryByRole('checkbox', { name: en.groups.edit.pin })).toBeNull();
    });
});
