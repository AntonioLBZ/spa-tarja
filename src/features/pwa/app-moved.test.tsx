import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { NEW_ADDRESS, NEW_HOST } from '@/lib/address';
import { LocaleProvider } from '@/lib/i18n';
import { createFakeAuth } from '@/lib/test/fake-auth';
import { renderApp } from '@/lib/test/render-app';

import { AppMoved } from './app-moved';

const text = en.pwa.moved;
const OLD_HOST = 'tarja.antoniolbz.workers.dev';

function visitFrom(hostname: string) {
    vi.stubGlobal('location', new URL(`https://${hostname}/`));
}

function renderMoved() {
    return render(
        <LocaleProvider>
            <AppMoved />
        </LocaleProvider>
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('AppMoved', () => {
    it.each(['tarja.albz.app', 'localhost'])('says nothing on %s', (hostname) => {
        visitFrom(hostname);

        renderMoved();

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('tells whoever opens the old address that the app moved, and where to', () => {
        visitFrom(OLD_HOST);

        renderMoved();

        const dialog = screen.getByRole('dialog', { name: text.title });
        expect(dialog.textContent).toContain(NEW_HOST);
        expect(screen.getByText(text.reinstall)).toBeDefined();
        const link = screen.getByRole('link', { name: text.open.replace('{address}', NEW_HOST) });
        expect(link.getAttribute('href')).toBe(NEW_ADDRESS);
    });

    it('lets them stay for now', () => {
        visitFrom(OLD_HOST);
        renderMoved();

        fireEvent.click(screen.getByRole('button', { name: text.stay }));

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('is back on the next visit, since staying is not remembered', () => {
        visitFrom(OLD_HOST);
        const first = renderMoved();
        fireEvent.click(screen.getByRole('button', { name: text.stay }));
        first.unmount();

        renderMoved();

        expect(screen.getByRole('dialog', { name: text.title })).toBeDefined();
    });
});

describe('AppMoved in the app', () => {
    it('shows over the sign-in screen, before anyone is signed in', async () => {
        visitFrom(OLD_HOST);

        renderApp({ fakeAuth: createFakeAuth({ session: null }) });

        expect(await screen.findByRole('dialog', { name: text.title })).toBeDefined();
    });
});
