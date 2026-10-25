import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';

const root = document.documentElement;

async function radio(name: string) {
    return (await screen.findByRole('radio', { name })) as HTMLInputElement;
}

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-color-transition');
    root.style.removeProperty('--duration-slow');
    document.head.innerHTML = '';
    vi.unstubAllGlobals();
});

describe('settings', () => {
    it('is reachable from the header, and the brand leads back home', async () => {
        stubApi(createFakeApi().handler);
        renderApp();

        fireEvent.click(await screen.findByRole('link', { name: en.nav.settings }));
        expect(await screen.findByRole('heading', { name: en.settings.title })).toBeDefined();

        fireEvent.click(screen.getByRole('link', { name: 'Tarja' }));
        expect(await screen.findByRole('heading', { name: en.expenses.form.title })).toBeDefined();
    });

    describe('language', () => {
        it('names each language in itself and marks the current one', async () => {
            renderApp({ path: '/settings' });

            expect((await radio('English')).checked).toBe(true);
            expect((await radio('Español')).checked).toBe(false);
        });

        it('switches the language, translates the page and keeps the choice', async () => {
            renderApp({ path: '/settings' });

            fireEvent.click(await radio('Español'));

            expect(await screen.findByRole('heading', { name: es.settings.title })).toBeDefined();
            expect(root.lang).toBe('es');
            expect(localStorage.getItem('tarja:locale')).toBe('es');
            expect((await radio('Español')).checked).toBe(true);
        });
    });

    describe('theme', () => {
        it('starts on the system theme, with no attribute on the root', async () => {
            renderApp({ path: '/settings' });

            expect((await radio(en.settings.theme.system)).checked).toBe(true);
            expect(root.hasAttribute('data-theme')).toBe(false);
        });

        it('applies an explicit choice and remembers it', async () => {
            renderApp({ path: '/settings' });

            fireEvent.click(await radio(en.settings.theme.dark));
            expect(root.dataset.theme).toBe('dark');
            expect(localStorage.getItem('tarja:theme')).toBe('dark');

            fireEvent.click(await radio(en.settings.theme.light));
            expect(root.dataset.theme).toBe('light');

            fireEvent.click(await radio(en.settings.theme.system));
            expect(root.hasAttribute('data-theme')).toBe(false);
            expect(localStorage.getItem('tarja:theme')).toBe('system');
        });

        it('comes back with the stored theme', async () => {
            localStorage.setItem('tarja:theme', 'dark');

            renderApp({ path: '/settings' });

            expect((await radio(en.settings.theme.dark)).checked).toBe(true);
            await waitFor(() => expect(root.dataset.theme).toBe('dark'));
        });

        it('moves the browser toolbar color with an explicit theme and gives it back for system', async () => {
            document.head.innerHTML = '<meta name="theme-color" content="#f4f4f4">';
            const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
            renderApp({ path: '/settings' });

            fireEvent.click(await radio(en.settings.theme.dark));
            expect(meta.content).not.toBe('#f4f4f4');

            fireEvent.click(await radio(en.settings.theme.system));
            expect(meta.content).toBe('#f4f4f4');
        });

        it('fades the colors while it changes', async () => {
            root.style.setProperty('--duration-slow', '50ms');
            renderApp({ path: '/settings' });

            fireEvent.click(await radio(en.settings.theme.dark));

            expect(root.hasAttribute('data-color-transition')).toBe(true);
            await waitFor(() => expect(root.hasAttribute('data-color-transition')).toBe(false));
        });
    });
});
