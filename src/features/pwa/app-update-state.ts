import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

type Register = typeof registerSW;

interface AppUpdate {
    // Whether a new version is installed and waits for the person's answer
    getState: () => boolean;
    subscribe: (listener: () => void) => () => void;
    // Registers the service worker; only the first call does
    start: () => void;
    // Hands the page to the new version, which reloads it
    apply: () => void;
    // Leaves the offer until another version comes
    postpone: () => void;
}

// The browser looks for a new version on its own when a page opens, never when an installed app comes back from the
// background. With no version running yet, or offline, there is nothing to look for.
const lookForUpdate = (registration: ServiceWorkerRegistration) => {
    if (!registration.active || !navigator.onLine) return;
    void registration.update().catch(() => undefined);
};

// The new version of the app, watched from the moment the page starts, whoever is signed in and whatever the data does
const createAppUpdate = (register: Register = registerSW): AppUpdate => {
    let waiting = false;
    let started = false;
    let applyUpdate: ReturnType<Register> | null = null;
    const listeners = new Set<() => void>();

    const commit = (next: boolean) => {
        if (next === waiting) return;
        waiting = next;
        listeners.forEach((listener) => listener());
    };

    const start = () => {
        if (started) return;
        started = true;
        applyUpdate = register({
            immediate: true,
            onNeedRefresh: () => commit(true),
            onRegisteredSW: (_url, registration) => {
                if (!registration) return;
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') lookForUpdate(registration);
                });
            },
        });
    };

    return {
        getState: () => waiting,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        start,
        apply: () => void applyUpdate?.(true),
        postpone: () => commit(false),
    };
};

// The one of the page
const appUpdate = createAppUpdate();

const useAppUpdateWaiting = () => {
    return useSyncExternalStore(appUpdate.subscribe, appUpdate.getState);
};

export { appUpdate, createAppUpdate, useAppUpdateWaiting, type AppUpdate };
