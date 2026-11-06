import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { createFakeAuth } from '@/lib/test/fake-auth';
import { renderApp, stubApi } from '@/lib/test/render-app';

const LOCALES = [
    { name: 'en', messages: en },
    { name: 'es', messages: es },
];

function openButton() {
    return screen.findByRole('button', { name: en.privacy.open });
}

async function openNotice(messages = en) {
    fireEvent.click(await screen.findByRole('button', { name: messages.privacy.open }));
    return screen.findByRole('dialog', { name: messages.privacy.title });
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('privacy notice in the settings', () => {
    it('is a button in the account section, and the notice is closed until it is pressed', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        const button = await openButton();

        const signOut = screen.getByRole('button', { name: en.settings.account.signOut });
        expect(signOut.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens as a dialog that takes the focus', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        const dialog = await openNotice();

        expect(document.activeElement).toBe(dialog);
    });

    it('closes with its Close button and opens again', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });
        const dialog = await openNotice();

        fireEvent.click(within(dialog).getByRole('button', { name: en.privacy.close }));

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(await openNotice()).toBeDefined();
    });

    it('closes the way Escape closes it, which the browser may do at any time', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });
        const dialog = (await openNotice()) as HTMLDialogElement;
        const cancel = new Event('cancel', { cancelable: true });

        dialog.dispatchEvent(cancel);
        dialog.close();

        expect(cancel.defaultPrevented).toBe(false);
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(await openNotice()).toBeDefined();
    });

    it('shows the email of the contact and links to it with the tag that tells the mail about the app apart', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });
        const dialog = await openNotice();

        const link = within(dialog).getByRole('link', { name: 'antoniolozbez@gmail.com' });

        expect(link.getAttribute('href')).toBe('mailto:antoniolozbez+tarja@gmail.com');
        expect(dialog.textContent).not.toContain('antoniolozbez+');
        expect(dialog.textContent).toContain('Antonio López Benítez');
        expect(dialog.textContent).toContain('La Coruña');
    });

    it('links to the portfolio', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });
        const dialog = await openNotice();

        const link = within(dialog).getByRole('link', { name: en.privacy.who.portfolio });

        expect(link.getAttribute('href')).toBe('https://albz.app');
    });

    it('points at the controls of the settings by the names they have there', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });
        const dialog = await openNotice();

        expect(dialog.textContent).toContain(en.settings.data.title);
        expect(dialog.textContent).toContain(en.settings.account.delete.open);
        expect(dialog.textContent).toContain(en.settings.profile.title);
    });

    it('sends no request of its own', async () => {
        const fetchMock = stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });
        const button = await openButton();
        await screen.findByRole('heading', { name: en.settings.data.title });
        const before = fetchMock.mock.calls.length;

        fireEvent.click(button);
        await screen.findByRole('dialog', { name: en.privacy.title });

        expect(fetchMock.mock.calls.length).toBe(before);
    });

    describe.each(LOCALES)('in $name', ({ name, messages }) => {
        it('has every section, the authority to complain to and the date of the last change', async () => {
            localStorage.setItem('tarja:locale', name);
            stubApi(createFakeApi().handler);
            renderApp({ path: '/settings' });

            const dialog = await openNotice(messages);

            const headings = [
                messages.privacy.who.title,
                messages.privacy.stored.title,
                messages.privacy.sees.title,
                messages.privacy.others.title,
                messages.privacy.keeps.title,
                messages.privacy.rights.title,
            ];
            for (const heading of headings) {
                expect(within(dialog).getByRole('heading', { name: heading })).toBeDefined();
            }
            expect(within(dialog).getByText(messages.privacy.updated)).toBeDefined();
            expect(within(dialog).getByText(messages.privacy.rights.complaint)).toBeDefined();
            expect(dialog.textContent).toContain('Agencia Española de Protección de Datos');
        });
    });
});

describe('privacy notice on the sign-in screen', () => {
    it('opens before signing in, beside the Google button, and closes', async () => {
        const fetchMock = stubApi(() => new Response(null, { status: 500 }));
        renderApp({ fakeAuth: createFakeAuth({ session: null }) });

        const dialog = await openNotice();

        expect(screen.getByRole('button', { name: en.auth.google })).toBeDefined();
        expect(within(dialog).getByRole('link', { name: 'antoniolozbez@gmail.com' }).getAttribute('href')).toBe(
            'mailto:antoniolozbez+tarja@gmail.com'
        );
        fireEvent.click(within(dialog).getByRole('button', { name: en.privacy.close }));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('opens offline with the server out of reach, and asks for nothing', async () => {
        const fetchMock = stubApi(() => new Response(null, { status: 500 }));
        const fakeAuth = createFakeAuth({ session: null });
        fakeAuth.state.offline = true;
        onlineManager.setOnline(false);
        renderApp({ fakeAuth });

        const dialog = await openNotice();

        expect(await screen.findByText(en.auth.unreachable)).toBeDefined();
        expect(within(dialog).getByRole('heading', { name: en.privacy.rights.title })).toBeDefined();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(fakeAuth.calls.startSignIn).toBe(0);
    });

    it('is read in Spanish when that is the language', async () => {
        localStorage.setItem('tarja:locale', 'es');
        stubApi(() => new Response(null, { status: 500 }));
        renderApp({ fakeAuth: createFakeAuth({ session: null }) });

        const dialog = await openNotice(es);

        expect(within(dialog).getByText(es.privacy.updated)).toBeDefined();
    });
});
