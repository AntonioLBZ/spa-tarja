import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { readCachedUser } from '@/lib/auth';
import { PERSIST_BUSTER, createUserStorage } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { Expense } from '@core/expense';

const root = document.documentElement;

async function radio(name: string) {
    return (await screen.findByRole('radio', { name })) as HTMLInputElement;
}

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-accent');
    root.removeAttribute('data-color-transition');
    root.style.removeProperty('--duration-slow');
    document.head.innerHTML = '';
    onlineManager.setOnline(true);
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

    describe('accent', () => {
        it('starts on amber, with no attribute on the root', async () => {
            renderApp({ path: '/settings' });

            expect((await radio(en.settings.accent.amber)).checked).toBe(true);
            expect(root.hasAttribute('data-accent')).toBe(false);
        });

        it('offers the fixed list, by name', async () => {
            renderApp({ path: '/settings' });

            await radio(en.settings.accent.amber);

            const names = screen
                .getAllByRole('radio')
                .filter((input) => (input as HTMLInputElement).name === 'accent')
                .map((input) => (input as HTMLInputElement).value);
            expect(names).toEqual(['amber', 'blue', 'green', 'violet', 'pink', 'gray']);
        });

        it('applies a choice and remembers it', async () => {
            renderApp({ path: '/settings' });

            fireEvent.click(await radio(en.settings.accent.violet));

            expect(root.dataset.accent).toBe('violet');
            expect(localStorage.getItem('tarja:accent')).toBe('violet');
            expect((await radio(en.settings.accent.violet)).checked).toBe(true);

            fireEvent.click(await radio(en.settings.accent.amber));
            expect(root.hasAttribute('data-accent')).toBe(false);
        });

        it('comes back with the stored accent', async () => {
            localStorage.setItem('tarja:accent', 'pink');

            renderApp({ path: '/settings' });

            expect((await radio(en.settings.accent.pink)).checked).toBe(true);
            await waitFor(() => expect(root.dataset.accent).toBe('pink'));
        });

        it('fades the colors while it changes', async () => {
            root.style.setProperty('--duration-slow', '50ms');
            renderApp({ path: '/settings' });

            fireEvent.click(await radio(en.settings.accent.blue));

            expect(root.hasAttribute('data-color-transition')).toBe(true);
            await waitFor(() => expect(root.hasAttribute('data-color-transition')).toBe(false));
        });
    });

    describe('categories', () => {
        it('is a section that says what categories are for, with the way in to manage them', async () => {
            stubApi(createFakeApi().handler);
            renderApp({ path: '/settings' });

            expect(await screen.findByRole('heading', { name: en.settings.categories.title })).toBeDefined();
            expect(screen.getByText(en.settings.categories.description)).toBeDefined();

            fireEvent.click(screen.getByRole('link', { name: en.settings.categories.link }));

            expect(await screen.findByRole('heading', { name: en.categoryManager.title })).toBeDefined();
        });

        it('is in Spanish too', async () => {
            localStorage.setItem('tarja:locale', 'es');
            stubApi(createFakeApi().handler);
            renderApp({ path: '/settings' });

            expect(await screen.findByRole('heading', { name: es.settings.categories.title })).toBeDefined();
            expect(screen.getByText(es.settings.categories.description)).toBeDefined();
            expect(screen.getByRole('link', { name: es.settings.categories.link })).toBeDefined();
        });
    });

    describe('account', () => {
        const pendingExpense: Expense = {
            id: crypto.randomUUID(),
            categoryId: 'food',
            text: 'Not sent yet',
            amountCents: 500,
            currency: 'EUR',
            date: '2026-10-25',
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
        };

        function signOutButton() {
            return screen.findByRole('button', { name: en.settings.account.signOut });
        }

        async function seedCopy(storage: ReturnType<typeof createMemoryStorage>, userId: string) {
            const { storage: mine } = createUserStorage(storage, userId);
            await mine.set('tarja:query-cache', {
                timestamp: Date.now(),
                buster: PERSIST_BUSTER,
                clientState: { mutations: [], queries: [] },
            });
        }

        it('shows who is signed in', async () => {
            renderApp({ path: '/settings' });

            expect(await screen.findByText(TEST_USER.name)).toBeDefined();
            expect(screen.getByText(TEST_USER.email)).toBeDefined();
        });

        it('signs out and asks to sign in again', async () => {
            const { fakeAuth } = renderApp({ path: '/settings' });

            fireEvent.click(await signOutButton());

            expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
            expect(fakeAuth.calls.signOut).toBe(1);
            expect(readCachedUser()).toBeNull();
        });

        it('says it is signing out while the server answers', async () => {
            renderApp({ path: '/settings' });

            fireEvent.click(await signOutButton());

            const button = (await screen.findByRole('button', {
                name: en.settings.account.signingOut,
            })) as HTMLButtonElement;
            expect(button.disabled).toBe(true);
        });

        it('stays signed in, and says why, when there is no connection to sign out', async () => {
            const { fakeAuth } = renderApp({ path: '/settings' });
            const button = await signOutButton();
            fakeAuth.state.offline = true;

            fireEvent.click(button);

            expect((await screen.findByRole('alert')).textContent).toBe(en.settings.account.signOutFailed);
            expect(screen.getByRole('heading', { name: en.settings.title })).toBeDefined();
            expect((await signOutButton()).hasAttribute('disabled')).toBe(false);
            expect(readCachedUser()).toEqual(TEST_USER);

            fakeAuth.state.offline = false;
            fireEvent.click(await signOutButton());

            expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('deletes what the user kept on the device when everything was synced', async () => {
            const storage = createMemoryStorage();
            await seedCopy(storage, TEST_USER.id);
            await seedCopy(storage, 'someone-else');
            renderApp({ path: '/settings', storage });

            fireEvent.click(await signOutButton());

            await waitFor(() => expect(storage.get(`tarja:query-cache:${TEST_USER.id}`)).resolves.toBeUndefined());
            expect(await storage.get('tarja:query-cache:someone-else')).toBeDefined();
            expect(screen.queryByText(en.settings.account.unsynced)).toBeNull();
        });

        it('keeps what has not synced for the next time, and says so', async () => {
            const storage = createMemoryStorage();
            await createUserStorage(storage, TEST_USER.id).storage.set('tarja:outbox', [pendingExpense]);
            await seedCopy(storage, TEST_USER.id);
            stubApi(createFakeApi().handler);
            onlineManager.setOnline(false);
            renderApp({ path: '/settings', storage });
            expect(await screen.findByText(en.settings.account.unsynced)).toBeDefined();

            fireEvent.click(await signOutButton());

            await screen.findByRole('heading', { name: en.auth.title });
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(await storage.get(`tarja:outbox:${TEST_USER.id}`)).toEqual([pendingExpense]);
            expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined();
        });
    });
});
