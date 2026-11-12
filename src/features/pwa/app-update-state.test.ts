import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAppUpdate } from './app-update-state';

import type { RegisterSWOptions } from 'virtual:pwa-register';

const fakeRegister = () => {
    const calls: RegisterSWOptions[] = [];
    const apply = vi.fn(async () => undefined);
    const register = vi.fn((options: RegisterSWOptions = {}) => {
        calls.push(options);
        return apply;
    });
    return { register, apply, calls };
};

const fakeRegistration = (active = true) => {
    const update = vi.fn(async () => undefined);
    const registration = { active: active ? {} : null, update } as unknown as ServiceWorkerRegistration;
    return { registration, update };
};

const showApp = (state: DocumentVisibilityState) => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
    document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('app update', () => {
    it('registers the service worker once, at once, however often it is started', () => {
        const { register, calls } = fakeRegister();
        const update = createAppUpdate(register);

        update.start();
        update.start();

        expect(register).toHaveBeenCalledTimes(1);
        expect(calls[0]?.immediate).toBe(true);
    });

    it('says a new version waits until the person postpones it, and tells who listens', () => {
        const { register, calls } = fakeRegister();
        const update = createAppUpdate(register);
        const listener = vi.fn();
        update.subscribe(listener);
        update.start();

        calls[0]?.onNeedRefresh?.();
        expect(update.getState()).toBe(true);
        update.postpone();

        expect(update.getState()).toBe(false);
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('hands the page to the new version on request', () => {
        const { register, apply } = fakeRegister();
        const update = createAppUpdate(register);
        update.start();

        update.apply();

        expect(apply).toHaveBeenCalledWith(true);
    });

    it('looks for a new version each time the app comes back to the screen', () => {
        const { register, calls } = fakeRegister();
        const { registration, update } = fakeRegistration();
        createAppUpdate(register).start();

        calls[0]?.onRegisteredSW?.('/sw.js', registration);
        showApp('hidden');
        expect(update).not.toHaveBeenCalled();
        showApp('visible');

        expect(update).toHaveBeenCalledTimes(1);
    });

    it('does not look for a new version offline, nor before any version runs', () => {
        const { register, calls } = fakeRegister();
        const first = fakeRegistration(false);
        const offline = fakeRegistration();
        createAppUpdate(register).start();

        calls[0]?.onRegisteredSW?.('/sw.js', first.registration);
        showApp('visible');
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        calls[0]?.onRegisteredSW?.('/sw.js', offline.registration);
        showApp('visible');

        expect(first.update).not.toHaveBeenCalled();
        expect(offline.update).not.toHaveBeenCalled();
    });
});
