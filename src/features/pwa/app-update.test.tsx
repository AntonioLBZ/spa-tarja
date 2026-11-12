import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { ToastProvider } from '@/components/toast/toast';
import { LocaleProvider } from '@/lib/i18n';

import { AppUpdate } from './app-update';

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

function Update() {
    return (
        <LocaleProvider>
            <ToastProvider dismissLabel="Dismiss">
                <AppUpdate />
            </ToastProvider>
        </LocaleProvider>
    );
}

function renderUpdate() {
    return render(<Update />);
}

afterEach(() => {
    registration.needRefresh = false;
    vi.clearAllMocks();
});

describe('AppUpdate', () => {
    it('shows nothing while no new version is waiting', () => {
        renderUpdate();

        expect(screen.queryByText(en.pwa.update.message)).toBeNull();
    });

    it('pins the offer once a new version is waiting and applies it on request', () => {
        registration.needRefresh = true;
        renderUpdate();

        expect(screen.getByRole('status').textContent).toContain(en.pwa.update.message);
        fireEvent.click(screen.getByRole('button', { name: en.pwa.update.apply }));

        expect(registration.updateServiceWorker).toHaveBeenCalledWith(true);
    });

    it('hides the offer when the user postpones it', () => {
        registration.needRefresh = true;
        renderUpdate();

        fireEvent.click(screen.getByRole('button', { name: en.pwa.update.dismiss }));

        expect(registration.setNeedRefresh).toHaveBeenCalledWith(false);
        expect(registration.updateServiceWorker).not.toHaveBeenCalled();
        expect(screen.queryByText(en.pwa.update.message)).toBeNull();
    });

    it('takes the offer away when no new version is waiting any more', () => {
        registration.needRefresh = true;
        const { rerender } = renderUpdate();
        expect(screen.getByText(en.pwa.update.message)).toBeDefined();

        registration.needRefresh = false;
        rerender(<Update />);

        expect(screen.queryByText(en.pwa.update.message)).toBeNull();
    });
});
