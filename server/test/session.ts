import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { env } from 'cloudflare:workers';

import { authOptions } from '@server/auth';

// What `app.request('/api/...')` uses as its origin
const ORIGIN = 'http://localhost';

interface TestSession {
    userId: string;
    // The cookie of a real session, as the browser would send it
    headers: Headers;
}

// A user and a session saved straight into the database, through the same secret and tables the app reads
const signIn = async (email = 'ana@example.com'): Promise<TestSession> => {
    const auth = betterAuth({ ...authOptions(env, ORIGIN), plugins: [testUtils()] });
    const { test } = await auth.$context;
    const user = await test.saveUser(test.createUser({ email, name: 'Ana' }));
    const { headers } = await test.login({ userId: user.id });
    return { userId: user.id, headers };
};

export { ORIGIN, signIn, type TestSession };
