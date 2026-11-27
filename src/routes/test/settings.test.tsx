import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { readCachedUser } from '@/lib/auth';
import { PERSIST_BUSTER, createUserStorage } from '@/lib/offline';
import { createFakeApi } from '@/lib/testing/fake-api';
import { TEST_USER } from '@/lib/testing/fake-auth';
import { createMemoryStorage } from '@/lib/testing/memory-storage';
import { renderApp, stubApi } from '@/lib/testing/render-app';

import type { PendingEntry } from '@/lib/offline';
import type { Expense } from '@core/expenses/expense';

const root = document.documentElement;

async function radio(name: string) {
    return (await screen.findByRole('radio', { name })) as HTMLInputElement;
}

afterEach(() => {
    localStorage.clear();
    root.removeAttribute('data-theme');
    root.removeAttribute('data-dark-tone');
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
        expect(await screen.findByRole('button', { name: en.nav.add })).toBeDefined();
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

    describe('the page of settings', () => {
        const link = (name: string) => screen.getByRole('link', { name });

        it('holds the language, the three cards together, Notifications and About, in this order', async () => {
            stubApi(createFakeApi().handler);
            renderApp({ path: '/settings' });

            const language = await screen.findByRole('group', { name: en.settings.language.title });
            const links = [en.settings.appearance.title, en.settings.categories.title, en.settings.account.title].map(
                link
            );
            const list = links[0]!.closest('ul')!;
            const notifications = screen.getByRole('heading', { name: en.settings.notifications.title });
            const about = screen.getByRole('heading', { name: en.settings.about.title });

            expect(links.every((item) => item.closest('ul') === list)).toBe(true);
            expect(within(list).getAllByRole('link')).toEqual(links);
            const order = [language, list, notifications, about];
            for (let i = 1; i < order.length; i++) {
                expect(
                    order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING
                ).toBeTruthy();
            }
            expect(screen.queryByRole('group', { name: en.settings.theme.title })).toBeNull();
            expect(screen.queryByRole('heading', { name: en.settings.data.title })).toBeNull();
        });

        it.each([
            [en.settings.appearance.title, '/settings/appearance', en.settings.appearance.title],
            [en.settings.categories.title, '/settings/categories', en.categoryManager.title],
            [en.settings.account.title, '/settings/account', en.settings.account.title],
        ])('leads from the card %s, its title alone and a chevron, to its page', async (name, href, title) => {
            stubApi(createFakeApi().handler);
            renderApp({ path: '/settings' });

            const card = await screen.findByRole('link', { name });
            expect(card.getAttribute('href')).toBe(href);
            expect(card.textContent).toBe(name);
            expect(card.querySelector('svg[data-icon="chevron_right"]')).not.toBeNull();
            expect(card.closest('.card')).not.toBeNull();

            fireEvent.click(card);

            expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined();
        });

        it.each([
            [en.settings.appearance.title, en.settings.appearance.hint],
            [en.settings.categories.title, en.settings.categories.hint],
        ])('says under the card %s, outside it, what its page holds', async (name, hint) => {
            stubApi(createFakeApi().handler);
            renderApp({ path: '/settings' });

            const card = await screen.findByRole('link', { name, description: hint });
            const text = screen.getByText(hint);

            expect(card.closest('.card')!.contains(text)).toBe(false);
            expect(card.closest('li')!.contains(text)).toBe(true);
            expect(card.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });

        it('says under the Account card the first name of the account and the email while there is no nickname', async () => {
            stubApi(createFakeApi().handler);
            renderApp({ path: '/settings' });

            expect(
                await screen.findByRole('link', {
                    name: en.settings.account.title,
                    description: `Ana · ${TEST_USER.email}`,
                })
            ).toBeDefined();
        });

        it('says under the Account card the nickname when there is one', async () => {
            stubApi(createFakeApi({ nickname: 'Anita' }).handler);
            renderApp({ path: '/settings' });

            expect(
                await screen.findByRole('link', {
                    name: en.settings.account.title,
                    description: `Anita · ${TEST_USER.email}`,
                })
            ).toBeDefined();
        });

        it('is in Spanish too', async () => {
            localStorage.setItem('tarja:locale', 'es');
            stubApi(createFakeApi().handler);
            renderApp({ path: '/settings' });

            expect(
                await screen.findByRole('link', {
                    name: es.settings.appearance.title,
                    description: es.settings.appearance.hint,
                })
            ).toBeDefined();
            expect(
                screen.getByRole('link', {
                    name: es.settings.categories.title,
                    description: es.settings.categories.hint,
                })
            ).toBeDefined();
            expect(screen.getByRole('link', { name: es.settings.account.title })).toBeDefined();
        });

        it('sends the old address of the categories to their page', async () => {
            stubApi(createFakeApi().handler);
            const { router } = renderApp({ path: '/categories' });

            expect(await screen.findByRole('heading', { level: 1, name: en.categoryManager.title })).toBeDefined();
            expect(router.state.location.pathname).toBe('/settings/categories');
        });
    });

    describe('the page of appearance', () => {
        it('has its title, the theme first and Amounts under it', async () => {
            renderApp({ path: '/settings/appearance' });

            const title = await screen.findByRole('heading', { level: 1, name: en.settings.appearance.title });
            const theme = screen.getByRole('group', { name: en.settings.theme.title });
            const amounts = screen.getByRole('heading', { name: en.settings.amounts.title });

            expect(title.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(theme.compareDocumentPosition(amounts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        });
    });

    describe('theme', () => {
        it('lists light and dark first and system last, the one that follows the device', async () => {
            renderApp({ path: '/settings/appearance' });
            await radio(en.settings.theme.light);

            const group = screen.getByRole('group', { name: en.settings.theme.title });

            expect(
                within(group)
                    .getAllByRole('radio')
                    .map((input) => (input as HTMLInputElement).value)
            ).toEqual(['light', 'dark', 'system']);
        });

        it('starts on the light theme', async () => {
            renderApp({ path: '/settings/appearance' });

            expect((await radio(en.settings.theme.light)).checked).toBe(true);
            expect((await radio(en.settings.theme.system)).checked).toBe(false);
            await waitFor(() => expect(root.dataset.theme).toBe('light'));
        });

        it('applies an explicit choice and remembers it', async () => {
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await radio(en.settings.theme.dark));
            expect(root.dataset.theme).toBe('dark');
            expect(localStorage.getItem('tarja:theme')).toBe('dark');

            fireEvent.click(await radio(en.settings.theme.light));
            expect(root.dataset.theme).toBe('light');

            fireEvent.click(await radio(en.settings.theme.system));
            expect(root.dataset.theme).toBe('system');
            expect(localStorage.getItem('tarja:theme')).toBe('system');
        });

        it('keeps the pure black switch off and out of reach on the light theme', async () => {
            renderApp({ path: '/settings/appearance' });

            const oled = await screen.findByRole('checkbox', { name: en.settings.theme.oled.label });

            expect((oled as HTMLInputElement).checked).toBe(false);
            expect((oled as HTMLInputElement).disabled).toBe(true);
            await waitFor(() => expect(root.dataset.darkTone).toBe('standard'));
        });

        it('turns the dark theme pure black and back, and remembers it', async () => {
            localStorage.setItem('tarja:theme', 'dark');
            renderApp({ path: '/settings/appearance' });
            const oled = (await screen.findByRole('checkbox', {
                name: en.settings.theme.oled.label,
            })) as HTMLInputElement;

            fireEvent.click(oled);
            expect(root.dataset.darkTone).toBe('oled');
            expect(localStorage.getItem('tarja:dark-tone')).toBe('oled');
            expect(oled.checked).toBe(true);

            fireEvent.click(oled);
            expect(root.dataset.darkTone).toBe('standard');
            expect(localStorage.getItem('tarja:dark-tone')).toBe('standard');
        });

        it('lets the system theme choose its dark tone too', async () => {
            localStorage.setItem('tarja:theme', 'system');
            localStorage.setItem('tarja:dark-tone', 'oled');
            renderApp({ path: '/settings/appearance' });

            const oled = (await screen.findByRole('checkbox', {
                name: en.settings.theme.oled.label,
            })) as HTMLInputElement;

            expect(oled.disabled).toBe(false);
            expect(oled.checked).toBe(true);
            await waitFor(() => expect(root.dataset.darkTone).toBe('oled'));
        });

        it('shows pure black off on the light theme and keeps the choice for when it is dark again', async () => {
            localStorage.setItem('tarja:dark-tone', 'oled');
            renderApp({ path: '/settings/appearance' });
            const oled = (await screen.findByRole('checkbox', {
                name: en.settings.theme.oled.label,
            })) as HTMLInputElement;

            expect(oled.checked).toBe(false);
            expect(oled.disabled).toBe(true);

            fireEvent.click(await radio(en.settings.theme.dark));

            expect(oled.checked).toBe(true);
            expect(root.dataset.darkTone).toBe('oled');
        });

        it('fades into the other tone while the page is dark', async () => {
            localStorage.setItem('tarja:theme', 'dark');
            root.style.setProperty('--duration-slow', '50ms');
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await screen.findByRole('checkbox', { name: en.settings.theme.oled.label }));

            expect(root.dataset.darkTone).toBe('oled');
            expect(root.hasAttribute('data-color-transition')).toBe(true);
            await waitFor(() => expect(root.hasAttribute('data-color-transition')).toBe(false));
        });

        it('changes the tone at once while System shows the light theme', async () => {
            vi.stubGlobal('matchMedia', (media: string) => ({
                matches: !media.includes('dark'),
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }));
            localStorage.setItem('tarja:theme', 'system');
            root.style.setProperty('--duration-slow', '50ms');
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await screen.findByRole('checkbox', { name: en.settings.theme.oled.label }));

            expect(root.dataset.darkTone).toBe('oled');
            expect(root.hasAttribute('data-color-transition')).toBe(false);
        });

        it('comes back with the stored theme', async () => {
            localStorage.setItem('tarja:theme', 'dark');

            renderApp({ path: '/settings/appearance' });

            expect((await radio(en.settings.theme.dark)).checked).toBe(true);
            await waitFor(() => expect(root.dataset.theme).toBe('dark'));
        });

        it('moves the browser toolbar color with an explicit theme and gives it back for system', async () => {
            document.head.innerHTML = '<meta name="theme-color" content="#f4f4f4">';
            const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await radio(en.settings.theme.dark));
            expect(meta.content).not.toBe('#f4f4f4');

            fireEvent.click(await radio(en.settings.theme.system));
            expect(meta.content).toBe('#f4f4f4');
        });

        it('changes at once between System and the theme the device already has', async () => {
            vi.stubGlobal('matchMedia', (media: string) => ({
                matches: media.includes('dark'),
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }));
            localStorage.setItem('tarja:theme', 'system');
            root.style.setProperty('--duration-slow', '50ms');
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await radio(en.settings.theme.dark));

            await waitFor(() => expect(root.dataset.theme).toBe('dark'));
            expect(root.hasAttribute('data-color-transition')).toBe(false);
        });

        it('fades the colors while it changes', async () => {
            root.style.setProperty('--duration-slow', '50ms');
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await radio(en.settings.theme.dark));

            expect(root.hasAttribute('data-color-transition')).toBe(true);
            await waitFor(() => expect(root.hasAttribute('data-color-transition')).toBe(false));
        });
    });

    describe('app color', () => {
        it('is gone: no choice of it, and the root is gray whatever an older version stored', async () => {
            localStorage.setItem('tarja:accent', 'pink');

            renderApp({ path: '/settings/appearance' });

            await radio(en.settings.theme.dark);
            expect(screen.queryAllByRole('radio').some((input) => (input as HTMLInputElement).name === 'accent')).toBe(
                false
            );
            expect(root.hasAttribute('data-accent')).toBe(false);
        });
    });

    describe('amounts', () => {
        const box = async (name: string) => (await screen.findByRole('checkbox', { name })) as HTMLInputElement;
        const stored = () => JSON.parse(localStorage.getItem('tarja:amounts') ?? '{}') as Record<string, unknown>;

        afterEach(() => {
            root.removeAttribute('data-money-palette');
        });

        it('comes after the theme, with every cue on, the usual palette and the euro', async () => {
            renderApp({ path: '/settings/appearance' });

            const heading = await screen.findByRole('heading', { name: en.settings.amounts.title });
            const theme = screen.getByRole('group', { name: en.settings.theme.title });
            expect(theme.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect((await box(en.settings.amounts.color.label)).checked).toBe(true);
            expect((await box(en.settings.amounts.sign.label)).checked).toBe(true);
            expect((await box(en.settings.amounts.arrows.label)).checked).toBe(true);
            expect((await box(en.settings.amounts.colorBlind.label)).checked).toBe(false);
            expect((await radio('€')).checked).toBe(true);
        });

        it('shows above the boxes an amount that comes in and one that goes out, as the choices draw them', async () => {
            renderApp({ path: '/settings/appearance' });
            const color = await box(en.settings.amounts.color.label);
            const sample = document.querySelector('.amount-settings__sample')!;
            const amounts = () => [...sample.querySelectorAll('.amount')];

            expect(sample.compareDocumentPosition(color) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
            expect(amounts().map((item) => item.textContent)).toEqual(['+€20.00', '−€12.50']);
            expect(amounts().map((item) => item.className)).toEqual(['amount amount--in', 'amount amount--out']);

            fireEvent.click(color);
            fireEvent.click(await box(en.settings.amounts.sign.label));

            expect(amounts().map((item) => item.textContent)).toEqual(['€20.00', '€12.50']);
            expect(amounts().map((item) => item.className)).toEqual(['amount', 'amount']);
        });

        it('turns each cue off and remembers it', async () => {
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await box(en.settings.amounts.sign.label));
            fireEvent.click(await box(en.settings.amounts.arrows.label));

            expect((await box(en.settings.amounts.sign.label)).checked).toBe(false);
            expect(stored()).toMatchObject({ color: true, sign: false, arrows: false });
        });

        it('switches to the palette for color blindness, only while color is on', async () => {
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await box(en.settings.amounts.colorBlind.label));
            expect(root.dataset.moneyPalette).toBe('color-blind');
            expect(stored()).toMatchObject({ colorBlind: true });

            fireEvent.click(await box(en.settings.amounts.color.label));
            expect((await box(en.settings.amounts.colorBlind.label)).disabled).toBe(true);
        });

        it('draws the symbol chosen, without converting anything', async () => {
            renderApp({ path: '/settings/appearance' });

            fireEvent.click(await radio('$'));

            expect(stored()).toMatchObject({ symbol: '$' });
            expect(screen.getByText('$20.00')).toBeDefined();
        });

        it('comes back as it was stored', async () => {
            localStorage.setItem('tarja:amounts', JSON.stringify({ sign: false, colorBlind: true, symbol: '£' }));

            renderApp({ path: '/settings/appearance' });

            expect((await box(en.settings.amounts.sign.label)).checked).toBe(false);
            expect((await radio('£')).checked).toBe(true);
            await waitFor(() => expect(root.dataset.moneyPalette).toBe('color-blind'));
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
            renderApp({ path: '/settings/account' });

            expect(await screen.findByText(TEST_USER.name)).toBeDefined();
            expect(screen.getByText(TEST_USER.email)).toBeDefined();
        });

        it('signs out and asks to sign in again', async () => {
            const { fakeAuth } = renderApp({ path: '/settings/account' });

            fireEvent.click(await signOutButton());

            expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
            expect(fakeAuth.calls.signOut).toBe(1);
            expect(readCachedUser()).toBeNull();
        });

        it('says it is signing out while the server answers', async () => {
            renderApp({ path: '/settings/account' });

            fireEvent.click(await signOutButton());

            const button = (await screen.findByRole('button', {
                name: en.settings.account.signingOut,
            })) as HTMLButtonElement;
            expect(button.disabled).toBe(true);
        });

        it('stays signed in, and says why, when there is no connection to sign out', async () => {
            const { fakeAuth } = renderApp({ path: '/settings/account' });
            const button = await signOutButton();
            fakeAuth.state.offline = true;

            fireEvent.click(button);

            expect((await screen.findByRole('alert')).textContent).toBe(en.settings.account.signOutFailed);
            expect(screen.getByRole('heading', { level: 1, name: en.settings.account.title })).toBeDefined();
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
            renderApp({ path: '/settings/account', storage });

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
            renderApp({ path: '/settings/account', storage });
            expect(await screen.findByText(en.settings.account.unsynced)).toBeDefined();

            fireEvent.click(await signOutButton());

            await screen.findByRole('heading', { name: en.auth.title });
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(await storage.get(`tarja:outbox:${TEST_USER.id}`)).toEqual([pendingExpense]);
            expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined();
        });

        it('keeps an expense of a group that has not synced for the next time, and says so', async () => {
            const pendingEntry: PendingEntry = {
                id: crypto.randomUUID(),
                groupId: crypto.randomUUID(),
                kind: 'settlement',
                text: '',
                categoryId: null,
                amountCents: 500,
                currency: 'EUR',
                date: '2026-10-25',
                paidBy: crypto.randomUUID(),
                split: 'exact',
                shares: [{ memberId: crypto.randomUUID(), cents: 500 }],
                payment: 'direct',
                chargeDate: null,
                createdAt: 1,
                updatedAt: 1,
                deletedAt: null,
            };
            const storage = createMemoryStorage();
            await createUserStorage(storage, TEST_USER.id).storage.set('tarja:group-outbox', [pendingEntry]);
            await seedCopy(storage, TEST_USER.id);
            stubApi(createFakeApi().handler);
            onlineManager.setOnline(false);
            renderApp({ path: '/settings/account', storage });
            expect(await screen.findByText(en.settings.account.unsynced)).toBeDefined();

            fireEvent.click(await signOutButton());

            await screen.findByRole('heading', { name: en.auth.title });
            await new Promise((resolve) => setTimeout(resolve, 0));
            expect(await storage.get(`tarja:group-outbox:${TEST_USER.id}`)).toEqual([pendingEntry]);
            expect(await storage.get(`tarja:query-cache:${TEST_USER.id}`)).toBeDefined();
        });
    });
});
