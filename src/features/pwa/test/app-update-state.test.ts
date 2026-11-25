import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAppUpdate } from '@/features/pwa/app-update-state';

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
    const events = new EventTarget();
    const fake = {
        active: active ? {} : null,
        installing: null as ServiceWorker | null,
        update,
        addEventListener: events.addEventListener.bind(events),
    };
    const registration = fake as unknown as ServiceWorkerRegistration;
    const findVersion = () => {
        const worker = Object.assign(new EventTarget(), { state: 'installing' }) as unknown as ServiceWorker;
        fake.installing = worker;
        events.dispatchEvent(new Event('updatefound'));
        return (state: ServiceWorkerState) => {
            Object.assign(worker, { state });
            fake.installing = null;
            worker.dispatchEvent(new Event('statechange'));
        };
    };
    return { registration, update, findVersion };
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
        expect(update.getState()).toBe('waiting');
        update.postpone();

        expect(update.getState()).toBe('none');
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

    it('says a new version downloads as soon as it is found, before it waits', () => {
        const { register, calls } = fakeRegister();
        const { registration, findVersion } = fakeRegistration();
        const update = createAppUpdate(register);
        update.start();
        calls[0]?.onRegisteredSW?.('/sw.js', registration);

        const settle = findVersion();
        expect(update.getState()).toBe('downloading');
        settle('installed');
        calls[0]?.onNeedRefresh?.();

        expect(update.getState()).toBe('waiting');
    });

    it('says nothing of the first install, with no version running yet', () => {
        const { register, calls } = fakeRegister();
        const { registration, findVersion } = fakeRegistration(false);
        const update = createAppUpdate(register);
        update.start();
        calls[0]?.onRegisteredSW?.('/sw.js', registration);

        findVersion();

        expect(update.getState()).toBe('none');
    });

    it('takes the offer away when the download fails', () => {
        const { register, calls } = fakeRegister();
        const { registration, findVersion } = fakeRegistration();
        const update = createAppUpdate(register);
        update.start();
        calls[0]?.onRegisteredSW?.('/sw.js', registration);

        findVersion()('redundant');

        expect(update.getState()).toBe('none');
    });

    it('keeps a version postponed while it downloads quiet until another one is found', () => {
        const { register, calls } = fakeRegister();
        const { registration, findVersion } = fakeRegistration();
        const update = createAppUpdate(register);
        update.start();
        calls[0]?.onRegisteredSW?.('/sw.js', registration);

        const settle = findVersion();
        update.postpone();
        settle('installed');
        calls[0]?.onNeedRefresh?.();
        expect(update.getState()).toBe('none');
        findVersion();

        expect(update.getState()).toBe('downloading');
    });

    it('says a version already downloading when the page starts downloads', () => {
        const { register, calls } = fakeRegister();
        const { registration, findVersion } = fakeRegistration();
        const update = createAppUpdate(register);
        update.start();
        findVersion();

        calls[0]?.onRegisteredSW?.('/sw.js', registration);

        expect(update.getState()).toBe('downloading');
    });
});
