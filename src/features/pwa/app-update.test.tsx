import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { ToastProvider } from '@/components/toast/toast';
import { LocaleProvider } from '@/lib/i18n';

import { AppUpdate } from './app-update';
import { appUpdate } from './app-update-state';

import type { RegisterSWOptions } from 'virtual:pwa-register';

const worker = vi.hoisted(() => ({
    options: undefined as RegisterSWOptions | undefined,
    update: vi.fn(async () => undefined),
}));

vi.mock('virtual:pwa-register', () => ({
    registerSW: (options: RegisterSWOptions) => {
        worker.options = options;
        return worker.update;
    },
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

function newVersionWaits() {
    act(() => worker.options?.onNeedRefresh?.());
}

beforeAll(() => {
    appUpdate.start();
});

afterEach(() => {
    act(() => appUpdate.postpone());
    vi.clearAllMocks();
});

describe('AppUpdate', () => {
    it('shows nothing while no new version is waiting', () => {
        render(<Update />);

        expect(screen.queryByText(en.pwa.update.message)).toBeNull();
    });

    it('pins the offer once a new version is waiting and applies it on request', () => {
        render(<Update />);
        newVersionWaits();

        expect(screen.getByRole('status').textContent).toContain(en.pwa.update.message);
        fireEvent.click(screen.getByRole('button', { name: en.pwa.update.apply }));

        expect(worker.update).toHaveBeenCalledWith(true);
    });

    it('shows the offer found before it was mounted, as when the version waits before the sign-in', () => {
        newVersionWaits();
        render(<Update />);

        expect(screen.getByRole('status').textContent).toContain(en.pwa.update.message);
    });

    it('hides the offer when the user postpones it', () => {
        render(<Update />);
        newVersionWaits();

        fireEvent.click(screen.getByRole('button', { name: en.pwa.update.dismiss }));

        expect(worker.update).not.toHaveBeenCalled();
        expect(screen.queryByText(en.pwa.update.message)).toBeNull();
    });
});
