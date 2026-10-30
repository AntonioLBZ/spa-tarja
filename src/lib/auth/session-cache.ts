import * as v from 'valibot';

import { authUserSchema, type AuthUser } from './user';

const STORAGE_KEY = 'tarja:session';

// The profile of the signed-in user, so the app opens signed in with no connection; it holds no credential
const readCachedUser = (): AuthUser | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const result = v.safeParse(authUserSchema, stored === null ? null : JSON.parse(stored));
        return result.success ? result.output : null;
    } catch {
        return null;
    }
};

const writeCachedUser = (user: AuthUser): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {
        // Without storage the app just asks the server on every open
    }
};

const clearCachedUser = (): void => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing stored, nothing to clear
    }
};

export { clearCachedUser, readCachedUser, writeCachedUser };
