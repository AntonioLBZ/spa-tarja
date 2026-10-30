import * as v from 'valibot';

import { ApiError } from '@/lib/api';

import { authUserSchema, type AuthUser } from './user';

// The three Better Auth calls the app makes; there is no Better Auth client, to keep the bundle small
interface AuthService {
    // The signed-in user, or null when the server says nobody is. Anything else, even an unreadable answer, throws.
    getSession: () => Promise<AuthUser | null>;
    // The Google page to send the person to
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
        getSession: async () => v.parse(sessionSchema, await send('/api/auth/get-session'))?.user ?? null,
        startSignIn: async () => {
            const body = { provider: 'google', callbackURL: '/', errorCallbackURL: '/?signin=failed' };
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
