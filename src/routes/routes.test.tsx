import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';

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

    it('puts Expenses first, then the logo, then Summary and Settings', async () => {
        await home();

        const nav = within(screen.getByRole('banner')).getByRole('navigation');
        expect(
            within(nav)
                .getAllByRole('link')
                .map((item) => item.textContent)
        ).toEqual([en.nav.expenses, 'Tarja', en.nav.summary, en.nav.settings]);
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

    it('leaves the form as it is on a click that opens the link elsewhere', async () => {
        await home();
        await screen.findByRole('heading', { name: en.expenses.form.title });
        const keepOnPage = (event: MouseEvent) => event.preventDefault();
        window.addEventListener('click', keepOnPage);

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

        window.removeEventListener('click', keepOnPage);
    });
});
