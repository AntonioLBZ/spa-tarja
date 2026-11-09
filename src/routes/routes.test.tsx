import { act, fireEvent, screen, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { stubViewport } from '@/lib/test/viewport';

const t = createTranslator({ locale: 'en', messages: en });

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('home', () => {
    it('shows the API as operational when the health check passes', async () => {
        stubApi((url) =>
            url.pathname === '/api/health' ? Response.json({ ok: true }) : new Response(null, { status: 404 })
        );

        renderApp();

        expect(await screen.findByText(en.home.health.ok)).toBeDefined();
    });

    it('shows the API as unreachable when the health check fails', async () => {
        stubApi(() => new Response(null, { status: 500 }));

        renderApp();

        expect(await screen.findByText(en.home.health.error)).toBeDefined();
    });
});

describe('header', () => {
    function link(name: string) {
        return screen.getByRole('link', { name });
    }

    function formToggle() {
        return screen.getByRole('button', { name: en.expenses.form.title });
    }

    function formOpen() {
        return formToggle().getAttribute('aria-expanded') === 'true';
    }

    async function home(path = '/') {
        stubApi(createFakeApi().handler);
        renderApp({ path });
        await screen.findByRole('navigation');
    }

    it('puts Expenses first, then the logo, then Groups, Summary and Settings', async () => {
        await home();

        const nav = within(screen.getByRole('banner')).getByRole('navigation');
        expect(
            within(nav)
                .getAllByRole('link')
                .map((item) => item.textContent)
        ).toEqual([en.nav.expenses, 'Tarja', en.nav.groups, en.nav.summary, en.nav.settings]);
        expect(link(en.nav.expenses).getAttribute('href')).toBe('/');
        expect(link('Tarja').getAttribute('href')).toBe('/');
    });

    it('opens the add form to start with', async () => {
        await home();

        expect(await screen.findByRole('heading', { name: en.expenses.form.title })).toBeDefined();
        expect(formOpen()).toBe(true);
    });

    it('collapses the add form from Expenses and opens it from the logo', async () => {
        await home();
        await screen.findByRole('heading', { name: en.expenses.form.title });

        fireEvent.click(link(en.nav.expenses));
        expect(formOpen()).toBe(false);

        fireEvent.click(link('Tarja'));
        expect(formOpen()).toBe(true);
    });

    it('collapses the form from Expenses again after it was opened by hand', async () => {
        await home();
        await screen.findByRole('heading', { name: en.expenses.form.title });
        fireEvent.click(link(en.nav.expenses));
        fireEvent.click(formToggle());

        fireEvent.click(link(en.nav.expenses));

        expect(formOpen()).toBe(false);
    });

    it('keeps what was typed in the form through Expenses and the logo', async () => {
        await home();
        await screen.findByRole('heading', { name: en.expenses.form.title });
        fireEvent.change(screen.getByLabelText(en.expenses.form.text), { target: { value: 'Lunch' } });

        fireEvent.click(link(en.nav.expenses));
        fireEvent.click(link('Tarja'));

        expect((screen.getByLabelText(en.expenses.form.text) as HTMLInputElement).value).toBe('Lunch');
    });

    it('brings Expenses from another screen to a collapsed form, and the logo to an open one', async () => {
        await home('/summary');

        fireEvent.click(link(en.nav.expenses));
        await screen.findByRole('heading', { name: en.expenses.form.title });
        expect(formOpen()).toBe(false);

        fireEvent.click(link(en.nav.settings));
        await screen.findByRole('heading', { name: en.settings.title });
        fireEvent.click(link('Tarja'));
        await screen.findByRole('heading', { name: en.expenses.form.title });
        expect(formOpen()).toBe(true);
    });

    function underlined() {
        return [...document.querySelectorAll('.root__underline')].map((mark) => mark.closest('a')!.textContent);
    }

    it('underlines Expenses at home, with a mark that is only decoration', async () => {
        await home();

        expect(underlined()).toEqual([en.nav.expenses]);
        expect(document.querySelector('.root__underline')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('moves the underline to the screen that was opened', async () => {
        await home();

        fireEvent.click(link(en.nav.summary));
        await screen.findByRole('heading', { name: en.summary.title });
        expect(underlined()).toEqual([en.nav.summary]);

        fireEvent.click(link(en.nav.settings));
        await screen.findByRole('heading', { name: en.settings.title });
        expect(underlined()).toEqual([en.nav.settings]);
    });

    it('opens Groups from its word, underlines only it and marks it as current', async () => {
        await home();

        fireEvent.click(link(en.nav.groups));

        expect(await screen.findByRole('heading', { level: 1, name: en.groups.title })).toBeDefined();
        expect(await screen.findByText(en.groups.empty)).toBeDefined();
        expect(underlined()).toEqual([en.nav.groups]);
        expect(link(en.nav.groups).getAttribute('aria-current')).toBe('page');
    });

    it('opens the Groups screen straight from its address', async () => {
        await home('/groups');

        expect(await screen.findByRole('heading', { level: 1, name: en.groups.title })).toBeDefined();
        expect(underlined()).toEqual([en.nav.groups]);
    });

    it.each([
        ['/charts', en.nav.summary, en.charts.title],
        ['/budgets', en.nav.summary, en.budgets.title],
        ['/categories', en.nav.settings, en.categoryManager.title],
    ])('underlines the section %s is reached from, which it marks as current', async (path, section, title) => {
        await home(path);
        await screen.findByRole('heading', { name: title });

        expect(underlined()).toEqual([section]);
        expect(link(section).getAttribute('aria-current')).toBe('true');
        expect(link(en.nav.expenses).hasAttribute('aria-current')).toBe(false);
    });

    it.each(['/', '/groups', '/summary', '/settings', '/charts', '/budgets', '/categories'])(
        'never underlines the logo, on %s or on the way home from it',
        async (path) => {
            await home(path);
            expect(underlined()).toHaveLength(1);
            expect(link('Tarja').querySelector('.root__underline')).toBeNull();

            fireEvent.click(link('Tarja'));

            await screen.findByRole('heading', { name: en.expenses.form.title });
            expect(underlined()).toEqual([en.nav.expenses]);
            expect(link('Tarja').querySelector('.root__underline')).toBeNull();
        }
    );

    it('leaves the form as it is on a click that opens the link elsewhere', async () => {
        await home();
        await screen.findByRole('heading', { name: en.expenses.form.title });
        const keepOnPage = (event: MouseEvent) => event.preventDefault();
        window.addEventListener('click', keepOnPage);

        try {
            fireEvent.click(link(en.nav.expenses), { ctrlKey: true });
            fireEvent.click(link(en.nav.expenses), { metaKey: true });
            fireEvent.click(link(en.nav.expenses), { shiftKey: true });
            fireEvent.click(link(en.nav.expenses), { altKey: true });
            fireEvent.click(link(en.nav.expenses), { button: 1 });
            expect(formOpen()).toBe(true);

            fireEvent.click(link(en.nav.expenses));
            fireEvent.click(link('Tarja'), { ctrlKey: true });
            fireEvent.click(link('Tarja'), { button: 1 });
            expect(formOpen()).toBe(false);
        } finally {
            window.removeEventListener('click', keepOnPage);
        }
    });
});

describe('prerelease logo', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    async function open(wide: boolean) {
        stubViewport(wide);
        stubApi(createFakeApi().handler);
        renderApp({ path: '/' });
        await screen.findByRole('navigation');
    }

    it.each([true, false])('names the logo Tarja-pre in the prerelease build (wide: %s)', async (wide) => {
        vi.stubEnv('VITE_PRERELEASE', 'true');

        await open(wide);

        expect(screen.getByRole('link', { name: 'Tarja-pre' }).getAttribute('href')).toBe('/');
        expect(screen.queryByRole('link', { name: 'Tarja' })).toBeNull();
    });

    it.each([true, false])('keeps the plain Tarja in production (wide: %s)', async (wide) => {
        await open(wide);

        expect(screen.getByRole('link', { name: 'Tarja' }).getAttribute('href')).toBe('/');
        expect(screen.queryByRole('link', { name: 'Tarja-pre' })).toBeNull();
    });
});

describe('bottom navigation', () => {
    const TABS = [en.nav.expenses, en.nav.groups, en.nav.summary, en.nav.settings];

    function tab(name: string) {
        return within(screen.getByRole('navigation', { name: en.nav.label })).getByRole('link', { name });
    }

    function formToggle() {
        return screen.getByRole('button', { name: en.expenses.form.title });
    }

    function formOpen() {
        return formToggle().getAttribute('aria-expanded') === 'true';
    }

    async function phone(path = '/') {
        const viewport = stubViewport(false);
        stubApi(createFakeApi().handler);
        renderApp({ path });
        await screen.findByRole('navigation');
        return viewport;
    }

    it('has one navigation, the bar, and only the logo in the header', async () => {
        await phone();

        expect(screen.getAllByRole('navigation')).toHaveLength(1);
        const links = within(screen.getByRole('navigation')).getAllByRole('link');
        expect(links.map((item) => item.textContent)).toEqual(TABS);
        expect(links.map((item) => item.getAttribute('href'))).toEqual(['/', '/groups', '/summary', '/settings']);
        const header = within(screen.getByRole('banner'));
        expect(header.getAllByRole('link').map((item) => item.textContent)).toEqual(['Tarja']);
        expect(document.querySelectorAll('.root__underline')).toHaveLength(0);
    });

    it('collapses the add form from Expenses and opens it from the logo, keeping what was typed', async () => {
        await phone();
        await screen.findByRole('heading', { name: en.expenses.form.title });
        fireEvent.change(screen.getByLabelText(en.expenses.form.text), { target: { value: 'Lunch' } });
        expect(formOpen()).toBe(true);

        fireEvent.click(tab(en.nav.expenses));
        expect(formOpen()).toBe(false);

        fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Tarja' }));
        expect(formOpen()).toBe(true);
        expect((screen.getByLabelText(en.expenses.form.text) as HTMLInputElement).value).toBe('Lunch');
    });

    it.each([
        ['/', en.nav.expenses],
        ['/groups', en.nav.groups],
        ['/summary', en.nav.summary],
        ['/settings', en.nav.settings],
        ['/charts', en.nav.summary],
        ['/budgets', en.nav.summary],
        ['/categories', en.nav.settings],
        ['/nowhere', en.nav.expenses],
    ])('marks only the tab %s is reached from', async (path, name) => {
        await phone(path);

        const marked = within(screen.getByRole('navigation'))
            .getAllByRole('link')
            .filter((item) => item.getAttribute('aria-current') === 'page')
            .map((item) => item.textContent);
        expect(marked).toEqual([name]);
    });

    it('moves to another tab and goes back to Expenses', async () => {
        await phone();

        fireEvent.click(tab(en.nav.groups));
        expect(await screen.findByRole('heading', { level: 1, name: en.groups.title })).toBeDefined();
        expect(tab(en.nav.groups).getAttribute('aria-current')).toBe('page');

        fireEvent.click(tab(en.nav.expenses));
        expect(await screen.findByRole('heading', { name: en.expenses.form.title })).toBeDefined();
        expect(tab(en.nav.expenses).getAttribute('aria-current')).toBe('page');
    });

    it('scrolls to the top when the current tab is pressed, without leaving the screen', async () => {
        await phone('/summary');
        await screen.findByRole('heading', { name: en.summary.title });
        const scrollTo = vi.spyOn(window, 'scrollTo');

        fireEvent.click(tab(en.nav.summary));

        expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
        expect(screen.getByRole('heading', { name: en.summary.title })).toBeDefined();
    });

    it('leaves the scroll alone on a tab that is not the current one', async () => {
        await phone('/summary');
        await screen.findByRole('heading', { name: en.summary.title });
        const scrollTo = vi.spyOn(window, 'scrollTo');

        fireEvent.click(tab(en.nav.settings));
        await screen.findByRole('heading', { name: en.settings.title });

        expect(scrollTo).not.toHaveBeenCalledWith({ top: 0 });
    });

    it.each([
        ['without a media query to ask', undefined],
        ['that answers the media query', stubViewport],
    ])('draws no bar on a wide screen %s', async (_, stub) => {
        stub?.(true);
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByRole('navigation');

        expect(document.querySelector('.bottom-nav')).toBeNull();
        expect(within(screen.getByRole('banner')).getAllByRole('link')).toHaveLength(5);
    });

    it('swaps the bar for the header words when the screen widens, keeping what was typed', async () => {
        const viewport = await phone();
        await screen.findByRole('heading', { name: en.expenses.form.title });
        fireEvent.change(screen.getByLabelText(en.expenses.form.text), { target: { value: 'Lunch' } });

        act(() => viewport.setWide(true));

        expect(document.querySelector('.bottom-nav')).toBeNull();
        const words = within(screen.getByRole('banner')).getAllByRole('link');
        expect(words.map((item) => item.textContent)).toEqual([en.nav.expenses, 'Tarja', ...TABS.slice(1)]);
        expect((screen.getByLabelText(en.expenses.form.text) as HTMLInputElement).value).toBe('Lunch');

        act(() => viewport.setWide(false));

        expect(screen.getAllByRole('navigation')).toHaveLength(1);
        expect(document.querySelector('.bottom-nav')).not.toBeNull();
    });
});

describe('the way back on a phone', () => {
    const group = sampleGroup({ name: 'Lisbon' });
    const other = sampleGroup({ name: 'Porto' });

    async function phone(path: string) {
        const viewport = stubViewport(false);
        stubApi(createFakeApi({ groups: [group, other] }).handler);
        renderApp({ path });
        const header = within(await screen.findByRole('banner'));
        return { header, viewport };
    }

    function backName(place: string) {
        return t('nav.back', { place });
    }

    it.each([
        ['/categories', en.nav.settings, '/settings'],
        ['/charts', en.nav.summary, '/summary'],
        ['/budgets', en.nav.summary, '/summary'],
        [`/groups/${group.id}`, en.nav.groups, '/groups'],
        [`/groups/${group.id}/edit`, en.nav.group, `/groups/${group.id}`],
    ])('leads from %s back to %s', async (path, place, href) => {
        const { header } = await phone(path);

        const link = header.getByRole('link', { name: backName(place) });
        expect(link.getAttribute('href')).toBe(href);
        expect(link.textContent).toBe(place);
        expect(header.getAllByRole('link')).toHaveLength(2);
    });

    it('takes the group of the address, not another one', async () => {
        const { header } = await phone(`/groups/${other.id}/edit`);

        expect(header.getByRole('link', { name: backName(en.nav.group) }).getAttribute('href')).toBe(
            `/groups/${other.id}`
        );
    });

    it('comes first in the header, ahead of the logo, with a chevron that is only decoration', async () => {
        const { header } = await phone('/charts');

        const links = header.getAllByRole('link');
        expect(links.map((item) => item.textContent)).toEqual([en.nav.summary, 'Tarja']);
        const chevron = links[0]!.querySelector('svg')!;
        expect(chevron.getAttribute('data-icon')).toBe('chevron_left');
        expect(chevron.getAttribute('aria-hidden')).toBe('true');
    });

    it('is named for the place it leads to, with the words that show in it', async () => {
        const { header } = await phone('/categories');

        const link = header.getByRole('link', { name: backName(en.nav.settings) });
        expect(link.getAttribute('aria-label')).toContain(link.textContent);
    });

    it.each([
        ['the home screen', '/'],
        ['Groups', '/groups'],
        ['Summary', '/summary'],
        ['Settings', '/settings'],
        ['the page of an invitation', `/join/${group.id}.token`],
        ['a page that does not exist', '/nowhere'],
    ])('has none on %s', async (_, path) => {
        const { header } = await phone(path);

        expect(header.getAllByRole('link').map((item) => item.textContent)).toEqual(['Tarja']);
    });

    it('goes to the parent whatever the history, from a screen opened by its address', async () => {
        await phone(`/groups/${group.id}/edit`);

        fireEvent.click(screen.getByRole('link', { name: backName(en.nav.group) }));
        expect(await screen.findByRole('heading', { level: 1, name: group.name! })).toBeDefined();

        fireEvent.click(screen.getByRole('link', { name: backName(en.nav.groups) }));
        expect(await screen.findByRole('heading', { level: 1, name: en.groups.title })).toBeDefined();
        expect(screen.queryByRole('link', { name: backName(en.nav.groups) })).toBeNull();
    });

    it('goes from the charts to the summary', async () => {
        await phone('/charts');

        fireEvent.click(screen.getByRole('link', { name: backName(en.nav.summary) }));

        expect(await screen.findByRole('heading', { name: en.summary.title })).toBeDefined();
        expect(screen.queryByRole('link', { name: backName(en.nav.summary) })).toBeNull();
    });

    it('is on a phone only: a wide screen has none, and gets it back when it narrows', async () => {
        const { header, viewport } = await phone('/charts');
        expect(header.queryByRole('link', { name: backName(en.nav.summary) })).not.toBeNull();

        act(() => viewport.setWide(true));

        expect(screen.queryByRole('link', { name: backName(en.nav.summary) })).toBeNull();

        act(() => viewport.setWide(false));

        expect(screen.queryByRole('link', { name: backName(en.nav.summary) })).not.toBeNull();
    });

    it('is not drawn when the browser cannot tell the width', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/charts' });
        await screen.findByRole('navigation');

        expect(screen.queryByRole('link', { name: backName(en.nav.summary) })).toBeNull();
    });
});
