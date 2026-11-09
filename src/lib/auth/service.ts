import * as v from 'valibot';

import { ApiError } from '@/lib/api';

import { invitationPath } from './invitation-path';
import { authUserSchema, type AuthUser } from './user';

// The three Better Auth calls the app makes; there is no Better Auth client, to keep the bundle small
interface AuthService {
    // The signed-in user, or null when the server says nobody is. Anything else, even an unreadable answer, throws.
    getSession: () => Promise<AuthUser | null>;
    // The Google page to send the person to, who comes back to the link of an invitation they opened, else home,
    // also when the sign-in fails
    startSignIn: () => Promise<string>;
    signOut: () => Promise<void>;
}

const sessionSchema = v.nullable(v.object({ user: authUserSchema }));
const signInSchema = v.object({ url: v.pipe(v.string(), v.minLength(1)) });

const JSON_HEADERS = { 'content-type': 'application/json' };

const send = async (path: string, init?: RequestInit): Promise<unknown> => {
    const response = await fetch(path, init);
    if (!response.ok) throw new ApiError(response.status);
    return response.json();
};

const createAuthService = (): AuthService => {
    return {
        // Past the cookie cache, which would still vouch for an account deleted from another device
        getSession: async () => {
            const answer = await send('/api/auth/get-session?disableCookieCache=true');
            return v.parse(sessionSchema, answer)?.user ?? null;
        },
        startSignIn: async () => {
            const callbackURL = invitationPath(window.location.pathname) ?? '/';
            const body = { provider: 'google', callbackURL, errorCallbackURL: `${callbackURL}?signin=failed` };
            const answer = await send('/api/auth/sign-in/social', {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify(body),
            });
            return v.parse(signInSchema, answer).url;
        },
        signOut: async () => {
            await send('/api/auth/sign-out', { method: 'POST', headers: JSON_HEADERS, body: '{}' });
        },
    };
};

export { createAuthService, type AuthService };
