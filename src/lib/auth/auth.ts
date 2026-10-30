import { clearCachedUser, readCachedUser, writeCachedUser } from './session-cache';

import type { AuthService } from './service';
import type { AuthUser } from './user';

type AuthState =
    | { status: 'loading' }
    // `unreachable`: the server couldn't be asked, which is not the same as nobody being signed in
    | { status: 'signed-out'; unreachable: boolean }
    | { status: 'signed-in'; user: AuthUser };

interface Auth {
    getState: () => AuthState;
    subscribe: (listener: () => void) => () => void;
    // Asks the server who is signed in. Only its definite answer changes who the user is: a failed request never
    // signs anybody out.
    check: () => Promise<void>;
    // Leaves the app for Google's page
    signIn: () => Promise<void>;
    // Needs the server, because only it can end the cookie; a failure leaves the user signed in
    signOut: () => Promise<void>;
}

const goTo = (url: string) => {
    window.location.assign(url);
};

const createAuth = (service: AuthService, navigate: (url: string) => void = goTo): Auth => {
    const cached = readCachedUser();
    let state: AuthState = cached ? { status: 'signed-in', user: cached } : { status: 'loading' };
    const listeners = new Set<() => void>();
    let checking: Promise<void> | null = null;

    const commit = (next: AuthState) => {
        state = next;
        listeners.forEach((listener) => listener());
    };

    const signedOut = (unreachable: boolean) => {
        clearCachedUser();
        commit({ status: 'signed-out', unreachable });
    };

    const ask = async () => {
        try {
            const user = await service.getSession();
            if (user === null) {
                if (state.status !== 'signed-out' || state.unreachable) signedOut(false);
                return;
            }
            writeCachedUser(user);
            if (state.status !== 'signed-in' || state.user.id !== user.id) commit({ status: 'signed-in', user });
        } catch {
            if (state.status === 'loading') commit({ status: 'signed-out', unreachable: true });
        }
    };

    return {
        getState: () => state,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        check: () => {
            checking ??= ask().finally(() => {
                checking = null;
            });
            return checking;
        },
        signIn: async () => navigate(await service.startSignIn()),
        signOut: async () => {
            await service.signOut();
            signedOut(false);
        },
    };
};

export { createAuth, type Auth, type AuthState };
