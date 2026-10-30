import { onlineManager } from '@tanstack/react-query';
import { createContext, use, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import type { Auth, AuthState } from './auth';
import type { AuthUser } from './user';

const AuthContext = createContext<Auth | null>(null);
const UserContext = createContext<AuthUser | null>(null);

interface AuthProviderProps {
    auth: Auth;
    children: ReactNode;
}

// Asks who is signed in when the app opens, and again when the connection returns after an open that couldn't ask
const AuthProvider = (props: AuthProviderProps) => {
    const { auth, children } = props;

    useEffect(() => {
        void auth.check();
        return onlineManager.subscribe((online) => {
            const state = auth.getState();
            if (online && state.status === 'signed-out' && state.unreachable) void auth.check();
        });
    }, [auth]);

    return <AuthContext value={auth}>{children}</AuthContext>;
};

const useAuth = (): Pick<Auth, 'check' | 'signIn' | 'signOut'> & { state: AuthState } => {
    const auth = use(AuthContext);
    if (auth === null) throw new Error('useAuth needs an AuthProvider');
    const state = useSyncExternalStore(auth.subscribe, auth.getState);
    return { state, check: auth.check, signIn: auth.signIn, signOut: auth.signOut };
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
