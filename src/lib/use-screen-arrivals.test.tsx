import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { stubViewport } from '@/lib/test/viewport';

import { beginSwipe, decideSwipe, markSwiped, markUndone } from './screen-arrival';

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    decideSwipe(true);
    vi.unstubAllGlobals();
});

const ana = person('Ana', { role: 'owner' });
const trip = sampleGroup({ name: 'Trip', members: [ana, person('Bea')], me: ana.id, pinnedAt: 1_000 });

const open = async (path: string) => {
    stubApi(createFakeApi({ groups: [trip] }).handler);
    const app = renderApp({ path });
    await screen.findAllByRole('button', { name: en.nav.add });
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    return app;
};

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

const link = (name: string) => screen.getByRole('link', { name });

const said = () => document.querySelector('.visually-hidden[role="status"]')!.textContent;

const press = (element: HTMLElement) => {
    element.focus();
    fireEvent.click(element);
};

describe('the title of the page', () => {
    it('is the name of the screen ahead of the name of the app', async () => {
        await open('/settings');

        await heading(en.settings.title);
        expect(document.title).toBe(`${en.settings.title} – Tarja`);
    });

    it('is Expenses on the home screen, and the screens of the charts and budgets say their own', async () => {
        const app = await open('/');
        await heading(en.expenses.list.title);
        expect(document.title).toBe(`${en.expenses.list.title} – Tarja`);

        await act(() => app.router.navigate({ to: '/charts' }));
        await heading(en.charts.title);
        expect(document.title).toBe(`${en.charts.title} – Tarja`);
    });

    it('follows the screen as it changes', async () => {
        await open('/');

        press(link(en.nav.settings));
        await heading(en.settings.title);

        expect(document.title).toBe(`${en.settings.title} – Tarja`);
    });

    it('is the name of the group on its screen', async () => {
        await open(`/groups/${trip.id}`);

        await heading('Trip');
        expect(document.title).toBe('Trip – Tarja');
    });

    it('is the name of the group while its tab is shown on the Expenses screen', async () => {
        await open('/');

        press(await screen.findByRole('link', { name: 'Trip' }));
        await heading('Trip');

        expect(document.title).toBe('Trip – Tarja');
    });
});

describe('a change of screen', () => {
    it('moves the focus to the heading of a screen that a card opens', async () => {
        await open('/settings');

        press(await screen.findByRole('link', { name: new RegExp(`^${en.settings.appearance.title}`) }));
        const title = await heading(en.settings.appearance.title);

        expect(document.activeElement).toBe(title);
    });

    it('moves the focus to the heading after an action that goes somewhere', async () => {
        const app = await open('/groups');

        await act(() => app.router.navigate({ to: '/groups/$groupId', params: { groupId: trip.id } }));
        const title = await heading('Trip');

        expect(document.activeElement).toBe(title);
    });

    it('leaves the focus on a link of the navigation and says the screen instead', async () => {
        await open('/');
        const settings = link(en.nav.settings);

        press(settings);
        await heading(en.settings.title);

        expect(document.activeElement).toBe(settings);
        await waitFor(() => expect(said()).toBe(en.settings.title));
    });

    it('says the screen, with the focus left where it is, when a swipe changed it', async () => {
        const app = await open('/');
        const other = screen.getAllByRole('button', { name: en.nav.add })[0]!;
        other.focus();

        markSwiped();
        await act(() => app.router.navigate({ to: '/summary' }));
        await heading(en.summary.title);

        expect(document.activeElement).toBe(other);
        await waitFor(() => expect(said()).toBe(en.summary.title));
    });

    it('says nothing of a swiped screen until the finger lifts, and then says it', async () => {
        const app = await open('/');
        const other = screen.getAllByRole('button', { name: en.nav.add })[0]!;
        other.focus();

        beginSwipe();
        markSwiped();
        await act(() => app.router.navigate({ to: '/summary' }));
        await heading(en.summary.title);
        await new Promise((resolve) => setTimeout(resolve, 250));
        expect(said()).toBe('');
        act(() => decideSwipe(true));

        expect(document.activeElement).toBe(other);
        await waitFor(() => expect(said()).toBe(en.summary.title));
    });

    it('says nothing at all of a swipe that goes back: not the screen it opened, nor the one it returns to', async () => {
        const app = await open('/');

        beginSwipe();
        markSwiped();
        await act(() => app.router.navigate({ to: '/summary' }));
        await heading(en.summary.title);
        act(() => decideSwipe(false));
        markUndone();
        await act(async () => app.router.history.back());
        await heading(en.expenses.list.title);
        await new Promise((resolve) => setTimeout(resolve, 250));

        expect(said()).toBe('');
    });

    it('goes back to saying the screens once a swipe that went back is over', async () => {
        const app = await open('/');
        beginSwipe();
        markSwiped();
        await act(() => app.router.navigate({ to: '/summary' }));
        await heading(en.summary.title);
        act(() => decideSwipe(false));
        markUndone();
        await act(async () => app.router.history.back());
        await heading(en.expenses.list.title);

        press(link(en.nav.settings));
        await heading(en.settings.title);

        await waitFor(() => expect(said()).toBe(en.settings.title));
    });

    it('leaves the focus on a tab of Expenses and says the group of the tab', async () => {
        await open('/');
        const tab = await screen.findByRole('link', { name: 'Trip' });

        press(tab);
        await heading('Trip');

        expect(document.activeElement).toBe(tab);
        await waitFor(() => expect(said()).toBe('Trip'));
    });

    it('leaves the focus where it is on a step back through the history, and says the screen', async () => {
        const app = await open('/settings');
        press(await screen.findByRole('link', { name: new RegExp(`^${en.settings.appearance.title}`) }));
        await heading(en.settings.appearance.title);

        await act(async () => app.router.history.back());
        const back = await heading(en.settings.title);

        expect(document.activeElement).not.toBe(back);
        await waitFor(() => expect(said()).toBe(en.settings.title));
    });

    it('does not take the focus when the app opens', async () => {
        await open('/settings');
        await heading(en.settings.title);

        expect(document.activeElement).toBe(document.body);
        expect(said()).toBe('');
    });

    it('leaves the focus on the logo, which is part of the navigation that is always there', async () => {
        await open('/settings');
        const logo = within(screen.getByRole('banner')).getByRole('link', { name: 'Tarja' });

        press(logo);
        await screen.findAllByRole('button', { name: en.nav.add });
        await heading(en.expenses.list.title);

        expect(document.activeElement).toBe(logo);
    });
});

describe('on a phone', () => {
    it('leaves the focus on the bar and says the screen', async () => {
        stubViewport(false);
        await open('/');
        const bar = screen.getByRole('navigation', { name: en.nav.label });
        const groups = within(bar).getByRole('link', { name: en.nav.groups });

        press(groups);
        await heading(en.groups.title);

        expect(document.activeElement).toBe(groups);
        await waitFor(() => expect(said()).toBe(en.groups.title));
    });

    it('moves the focus to the heading when the link back of the header is pressed', async () => {
        stubViewport(false);
        await open('/settings/appearance');
        const back = within(screen.getByRole('banner')).getByRole('link', { name: /Back/ });

        press(back);
        const title = await heading(en.settings.title);

        expect(document.activeElement).toBe(title);
    });
});
