import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { readCachedUser } from '@/lib/auth';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER, createFakeAuth } from '@/lib/test/fake-auth';
import { renderApp, stubApi } from '@/lib/test/render-app';

function googleButton() {
    return screen.getByRole('button', { name: en.auth.google }) as HTMLButtonElement;
}

afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('sign-in gate', () => {
    describe('with somebody signed in', () => {
        it('shows the app', async () => {
            stubApi(createFakeApi().handler);

            renderApp();

            expect(await screen.findByRole('heading', { name: en.expenses.form.title })).toBeDefined();
            expect(screen.queryByRole('button', { name: en.auth.google })).toBeNull();
        });

        it('shows the app with the server out of reach, as the device remembers the user', async () => {
            stubApi(createFakeApi().handler);
            const fakeAuth = createFakeAuth();
            fakeAuth.state.offline = true;

            renderApp({ fakeAuth });

            expect(await screen.findByRole('heading', { name: en.expenses.form.title })).toBeDefined();
            await waitFor(() => expect(fakeAuth.calls.getSession).toBe(1));
            expect(screen.queryByRole('button', { name: en.auth.google })).toBeNull();
        });
    });

    describe('with nobody signed in', () => {
        it('asks to sign in with Google instead of showing the app', async () => {
            const fakeAuth = createFakeAuth({ session: null });

            renderApp({ fakeAuth });

            expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
            expect(googleButton()).toBeDefined();
            expect(screen.queryByRole('heading', { name: en.expenses.form.title })).toBeNull();
            expect(screen.queryByRole('link', { name: en.nav.settings })).toBeNull();
        });

        it('does not flash the sign-in screen while it asks the server', async () => {
            const fakeAuth = createFakeAuth({ session: TEST_USER, cached: null });
            stubApi(createFakeApi().handler);

            renderApp({ fakeAuth });

            expect(screen.queryByRole('button', { name: en.auth.google })).toBeNull();
            expect(screen.getByRole('status').textContent).toBe(en.auth.loading);
            expect(await screen.findByRole('heading', { name: en.expenses.form.title })).toBeDefined();
        });

        it('sends the person to the page Google lives at', async () => {
            const fakeAuth = createFakeAuth({ session: null });
            renderApp({ fakeAuth });
            await screen.findByRole('heading', { name: en.auth.title });

            fireEvent.click(googleButton());

            await waitFor(() => expect(fakeAuth.navigated).toEqual(['https://accounts.google.com/test']));
            expect(fakeAuth.calls.startSignIn).toBe(1);
        });

        it('says it is opening Google, and does not start twice', async () => {
            const fakeAuth = createFakeAuth({ session: null });
            renderApp({ fakeAuth });
            await screen.findByRole('heading', { name: en.auth.title });

            fireEvent.click(googleButton());

            const button = (await screen.findByRole('button', { name: en.auth.opening })) as HTMLButtonElement;
            expect(button.disabled).toBe(true);
            fireEvent.click(button);
            expect(fakeAuth.calls.startSignIn).toBe(1);
        });

        it('tells the person when Google cannot be started, and lets them try again', async () => {
            const fakeAuth = createFakeAuth({ session: null });
            fakeAuth.state.signInFails = true;
            renderApp({ fakeAuth });
            await screen.findByRole('heading', { name: en.auth.title });

            fireEvent.click(googleButton());

            expect((await screen.findByRole('alert')).textContent).toBe(en.auth.failed);
            expect(googleButton().disabled).toBe(false);
            expect(fakeAuth.navigated).toEqual([]);

            fakeAuth.state.signInFails = false;
            fireEvent.click(googleButton());

            await waitFor(() => expect(fakeAuth.navigated).toHaveLength(1));
            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('tells the person when Google sent them back without signing in', async () => {
            window.history.replaceState(null, '', '/?signin=failed');
            renderApp({ fakeAuth: createFakeAuth({ session: null }) });

            expect((await screen.findByRole('alert')).textContent).toBe(en.auth.failed);
        });

        it('lets the person try again after coming back from Google with the back button', async () => {
            const fakeAuth = createFakeAuth({ session: null });
            renderApp({ fakeAuth });
            await screen.findByRole('heading', { name: en.auth.title });
            fireEvent.click(googleButton());
            await screen.findByRole('button', { name: en.auth.opening });

            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

            expect((await screen.findByRole('button', { name: en.auth.google })) as HTMLButtonElement).toBeDefined();
        });

        it('keeps saying it is opening Google on a page shown for the first time', async () => {
            const fakeAuth = createFakeAuth({ session: null });
            renderApp({ fakeAuth });
            await screen.findByRole('heading', { name: en.auth.title });
            fireEvent.click(googleButton());
            await screen.findByRole('button', { name: en.auth.opening });

            act(() => {
                window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
            });

            expect(screen.getByRole('button', { name: en.auth.opening })).toBeDefined();
        });

        it('says nothing of failure on a plain visit', async () => {
            renderApp({ fakeAuth: createFakeAuth({ session: null }) });
            await screen.findByRole('heading', { name: en.auth.title });

            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('says the server is out of reach, and opens the app once it is back', async () => {
            stubApi(createFakeApi().handler);
            const fakeAuth = createFakeAuth({ session: TEST_USER, cached: null });
            fakeAuth.state.offline = true;
            onlineManager.setOnline(false);
            renderApp({ fakeAuth });

            expect((await screen.findByRole('alert')).textContent).toBe(en.auth.unreachable);
            expect(screen.queryByRole('heading', { name: en.expenses.form.title })).toBeNull();

            fakeAuth.state.offline = false;
            onlineManager.setOnline(true);

            expect(await screen.findByRole('heading', { name: en.expenses.form.title })).toBeDefined();
            expect(screen.queryByRole('alert')).toBeNull();
        });

        it('does not ask again when the connection returns while the server was never out of reach', async () => {
            const fakeAuth = createFakeAuth({ session: null });
            renderApp({ fakeAuth });
            await screen.findByRole('heading', { name: en.auth.title });
            expect(fakeAuth.calls.getSession).toBe(1);

            onlineManager.setOnline(false);
            onlineManager.setOnline(true);

            expect(fakeAuth.calls.getSession).toBe(1);
        });
    });

    describe('when the session ends', () => {
        it('asks to sign in as soon as the server says so, and forgets the user', async () => {
            const api = createFakeApi();
            stubApi(api.handler);
            const fakeAuth = createFakeAuth();
            const { queryClient } = renderApp({ fakeAuth });
            await screen.findByText(en.expenses.list.empty);

            fakeAuth.state.session = null;
            api.state.unauthorized = true;
            await queryClient.invalidateQueries();

            expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
            expect(screen.queryByRole('heading', { name: en.expenses.form.title })).toBeNull();
            expect(readCachedUser()).toBeNull();
        });

        it('keeps the app when the server refuses a request but still knows the session', async () => {
            const api = createFakeApi();
            stubApi(api.handler);
            const fakeAuth = createFakeAuth();
            const { queryClient } = renderApp({ fakeAuth });
            await screen.findByText(en.expenses.list.empty);
            const checks = fakeAuth.calls.getSession;

            api.state.unauthorized = true;
            await queryClient.invalidateQueries();

            await waitFor(() => expect(fakeAuth.calls.getSession).toBeGreaterThan(checks));
            expect(screen.getByRole('heading', { name: en.expenses.form.title })).toBeDefined();
            expect(screen.queryByRole('heading', { name: en.auth.title })).toBeNull();
        });

        it('keeps the app when the check itself cannot reach the server', async () => {
            const api = createFakeApi();
            stubApi(api.handler);
            const fakeAuth = createFakeAuth();
            const { queryClient } = renderApp({ fakeAuth });
            await screen.findByText(en.expenses.list.empty);
            const checks = fakeAuth.calls.getSession;

            fakeAuth.state.offline = true;
            api.state.unauthorized = true;
            await queryClient.invalidateQueries();

            await waitFor(() => expect(fakeAuth.calls.getSession).toBeGreaterThan(checks));
            expect(screen.getByRole('heading', { name: en.expenses.form.title })).toBeDefined();
        });
    });
});
