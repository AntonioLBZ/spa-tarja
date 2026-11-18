import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

type Register = typeof registerSW;

// Nothing to offer, a new version found and downloading, or one installed and waiting for the person's answer
type AppUpdateState = 'none' | 'downloading' | 'waiting';

interface AppUpdate {
    getState: () => AppUpdateState;
    subscribe: (listener: () => void) => () => void;
    // Registers the service worker; only the first call does
    start: () => void;
    // Hands the page to the new version, which reloads it
    apply: () => void;
    // Leaves the offer until another version is found
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
    let state: AppUpdateState = 'none';
    // Later was answered while the version downloaded, so its waiting is not offered
    let quiet = false;
    let started = false;
    let applyUpdate: ReturnType<Register> | null = null;
    const listeners = new Set<() => void>();

    const commit = (next: AppUpdateState) => {
        if (next === state) return;
        state = next;
        listeners.forEach((listener) => listener());
    };

    // A new version found while another one runs: the first install is no update
    const watchInstall = (registration: ServiceWorkerRegistration) => {
        const installing = registration.installing;
        if (!installing || !registration.active) return;
        quiet = false;
        if (state === 'none') commit('downloading');
        installing.addEventListener('statechange', () => {
            if (installing.state !== 'redundant') return;
            quiet = false;
            if (state === 'downloading') commit('none');
        });
    };

    const start = () => {
        if (started) return;
        started = true;
        applyUpdate = register({
            immediate: true,
            onNeedRefresh: () => {
                if (quiet) quiet = false;
                else commit('waiting');
            },
            onRegisteredSW: (_url, registration) => {
                if (!registration) return;
                watchInstall(registration);
                registration.addEventListener('updatefound', () => watchInstall(registration));
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') lookForUpdate(registration);
                });
            },
        });
    };

    return {
        getState: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        start,
        apply: () => void applyUpdate?.(true),
        postpone: () => {
            quiet = state === 'downloading';
            commit('none');
        },
    };
};

// The one of the page
const appUpdate = createAppUpdate();

const useAppUpdateState = () => {
    return useSyncExternalStore(appUpdate.subscribe, appUpdate.getState);
};

export { appUpdate, createAppUpdate, useAppUpdateState, type AppUpdate, type AppUpdateState };
