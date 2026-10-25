import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { LocaleProvider } from '@/lib/i18n';

import { UpdatePrompt } from './update-prompt';

const registration = vi.hoisted(() => ({
    needRefresh: false,
    setNeedRefresh: vi.fn(),
    updateServiceWorker: vi.fn(),
}));

vi.mock('virtual:pwa-register/react', () => ({
    useRegisterSW: () => ({
        needRefresh: [registration.needRefresh, registration.setNeedRefresh],
        offlineReady: [false, vi.fn()],
        updateServiceWorker: registration.updateServiceWorker,
    }),
}));

function renderPrompt() {
    return render(
        <LocaleProvider>
            <UpdatePrompt />
        </LocaleProvider>
    );
}

afterEach(() => {
    registration.needRefresh = false;
    vi.clearAllMocks();
});

describe('UpdatePrompt', () => {
    it('renders nothing while no new version is waiting', () => {
        renderPrompt();

        expect(screen.queryByText(en.pwa.update.message)).toBeNull();
    });

    it('offers the update once a new version is waiting and applies it on request', () => {
        registration.needRefresh = true;
        renderPrompt();

        expect(screen.getByText(en.pwa.update.message)).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: en.pwa.update.apply }));

        expect(registration.updateServiceWorker).toHaveBeenCalledWith(true);
    });

    it('hides the offer when the user postpones it', () => {
        registration.needRefresh = true;
        renderPrompt();

        fireEvent.click(screen.getByRole('button', { name: en.pwa.update.dismiss }));

        expect(registration.setNeedRefresh).toHaveBeenCalledWith(false);
        expect(registration.updateServiceWorker).not.toHaveBeenCalled();
    });
});
