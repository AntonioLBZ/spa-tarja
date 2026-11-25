import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { env } from 'cloudflare:workers';

import { USER_HEADER } from '@core/account';
import { app } from '@server/app';
import { authOptions } from '@server/auth';

// What `app.request('/api/...')` uses as its origin
const ORIGIN = 'http://localhost';

interface TestSession {
    userId: string;
    // The cookie of a real session, as the browser would send it
    headers: Headers;
}

// A user and a session saved straight into the database, through the same secret and tables the app reads
const signIn = async (email = 'ana@example.com', name = 'Ana'): Promise<TestSession> => {
    const auth = betterAuth({ ...authOptions(env, ORIGIN), plugins: [testUtils()] });
    const { test } = await auth.$context;
    const user = await test.saveUser(test.createUser({ email, name }));
    const { headers } = await test.login({ userId: user.id });
    return { userId: user.id, headers };
};

// Another session of the same user, as on a second device
const signInAgain = async (session: TestSession): Promise<TestSession> => {
    const auth = betterAuth({ ...authOptions(env, ORIGIN), plugins: [testUtils()] });
    const { test } = await auth.$context;
    const { headers } = await test.login({ userId: session.userId });
    return { userId: session.userId, headers };
};

// The same session with the cookie cache a browser gets once it has asked who is signed in, which the server trusts for
// a few minutes without reading the session from the database
const cachedSession = async (session: TestSession): Promise<TestSession> => {
    const response = await app.request('/api/auth/get-session', { headers: session.headers }, env);
    const cache = response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]);
    if (cache.length === 0) throw new Error('The session came without a cookie cache');
    const headers = new Headers({ cookie: [session.headers.get('cookie'), ...cache].join('; ') });
    return { userId: session.userId, headers };
};

// The same session sent from a window that was opened for another user, as the web app does
const sentAs = (session: TestSession, windowUserId: string): TestSession => {
    const headers = new Headers(session.headers);
    headers.set(USER_HEADER, windowUserId);
    return { userId: session.userId, headers };
};

export { ORIGIN, cachedSession, sentAs, signIn, signInAgain, type TestSession };
