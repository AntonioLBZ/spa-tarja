import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

async function openAbout() {
    const heading = await screen.findByRole('heading', { name: en.settings.about.title });
    return within(heading.closest('section')!);
}

function row(about: ReturnType<typeof within>, name: string) {
    return about.getByText(name).closest('div')!;
}

describe('About', () => {
    it('is the last section of the settings, after the account', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        const about = await screen.findByRole('heading', { name: en.settings.about.title });
        const account = screen.getByRole('heading', { name: en.settings.account.title });

        expect(account.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        const sections = document.querySelectorAll('.settings > section');
        expect(sections[sections.length - 1]!.contains(about)).toBe(true);
    });

    it('shows the version of the build', async () => {
        vi.stubEnv('VITE_APP_VERSION', '1.2.3');
        vi.stubEnv('VITE_APP_COMMIT', '');
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        const about = await openAbout();

        expect(row(about, en.settings.about.version).textContent).toBe(`${en.settings.about.version}1.2.3`);
    });

    it('adds the commit to the version of a prerelease build', async () => {
        vi.stubEnv('VITE_APP_VERSION', '1.2.3');
        vi.stubEnv('VITE_APP_COMMIT', 'abc1234');
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        const about = await openAbout();

        expect(row(about, en.settings.about.version).textContent).toBe(`${en.settings.about.version}1.2.3+abc1234`);
    });

    it('says the server is operational when the health check passes', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        const about = await openAbout();

        expect(await about.findByText(en.settings.about.status.ok)).toBeDefined();
        const value = about.getByRole('status');
        expect(value.textContent).toBe(en.settings.about.status.ok);
        expect(value.className).not.toContain('about__status--error');
    });

    it('says it is checking until the first answer arrives', async () => {
        stubApi((url) => (url.pathname === '/api/health' ? new Promise<Response>(() => {}) : new Response(null)));
        renderApp({ path: '/settings' });

        const about = await openAbout();

        expect(about.getByRole('status').textContent).toBe(en.settings.about.status.pending);
    });

    it('says the server cannot be reached when the health check fails, in the danger color', async () => {
        stubApi(() => new Response(null, { status: 500 }));
        renderApp({ path: '/settings' });

        const about = await openAbout();

        expect(await about.findByText(en.settings.about.status.error)).toBeDefined();
        expect(about.getByRole('status').className).toContain('about__status--error');
    });

    it('says the server cannot be reached while offline', async () => {
        const api = createFakeApi();
        stubApi(api.handler);
        api.state.offline = true;
        renderApp({ path: '/settings' });

        const about = await openAbout();

        expect(await about.findByText(en.settings.about.status.error)).toBeDefined();
    });

    it('is written in Spanish when the language is', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });
        fireEvent.click(await screen.findByRole('radio', { name: 'Español' }));

        const heading = await screen.findByRole('heading', { name: es.settings.about.title });
        const about = within(heading.closest('section')!);

        expect(about.getByText(es.settings.about.version)).toBeDefined();
        await waitFor(() => expect(about.getByRole('status').textContent).toBe(es.settings.about.status.ok));
    });

    it('is not asked of the health check by the home screen', async () => {
        const api = createFakeApi();
        const fetchMock = stubApi(api.handler);
        renderApp({ path: '/' });
        await screen.findByRole('button', { name: en.nav.add });

        expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContainEqual(
            expect.stringContaining('/api/health')
        );
    });
});
