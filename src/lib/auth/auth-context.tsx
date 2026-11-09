import { onlineManager } from '@tanstack/react-query';
import { createContext, use, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import { SESSION_STORAGE_KEY } from './session-cache';

import type { Auth, AuthState } from './auth';
import type { AuthUser } from './user';

const AuthContext = createContext<Auth | null>(null);
const UserContext = createContext<AuthUser | null>(null);

interface AuthProviderProps {
    auth: Auth;
    children: ReactNode;
}

// Asks who is signed in when the app opens, and again when the connection returns after an open that couldn't ask. The
// browser's cookie is shared by every window, so it also asks when the window becomes visible and when another window
// stores or forgets the session, in case another account has signed in since.
const AuthProvider = (props: AuthProviderProps) => {
    const { auth, children } = props;

    useEffect(() => {
        void auth.check();
        const unsubscribe = onlineManager.subscribe((online) => {
            const state = auth.getState();
            if (online && state.status === 'signed-out' && state.unreachable) void auth.check();
        });
        const onVisibility = () => {
            if (document.visibilityState === 'visible') void auth.check();
        };
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === SESSION_STORAGE_KEY) void auth.check();
        };
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('storage', onStorage);
        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('storage', onStorage);
        };
    }, [auth]);

    return <AuthContext value={auth}>{children}</AuthContext>;
};

const useAuth = (): Pick<Auth, 'check' | 'getState' | 'signIn' | 'signOut' | 'forget'> & { state: AuthState } => {
    const auth = use(AuthContext);
    if (auth === null) throw new Error('useAuth needs an AuthProvider');
    const state = useSyncExternalStore(auth.subscribe, auth.getState);
    return {
        state,
        check: auth.check,
        getState: auth.getState,
        signIn: auth.signIn,
        signOut: auth.signOut,
        forget: auth.forget,
    };
};

interface UserProviderProps {
    user: AuthUser;
    children: ReactNode;
}

// Whoever is signed in, for what only exists while somebody is
const UserProvider = (props: UserProviderProps) => {
    const { user, children } = props;
    return <UserContext value={user}>{children}</UserContext>;
};

const useUser = (): AuthUser => {
    const user = use(UserContext);
    if (user === null) throw new Error('useUser needs a signed-in user');
    return user;
};

export { AuthProvider, UserProvider, useAuth, useUser, type AuthProviderProps, type UserProviderProps };
