import { clearCachedUser, createAuth, writeCachedUser, type AuthService, type AuthUser } from '@/lib/auth';

const TEST_USER: AuthUser = { id: 'user-ana', name: 'Ana Pérez', email: 'ana@example.com' };

interface FakeAuthOptions {
    // Who the server says is signed in; null for nobody
    session?: AuthUser | null;
    // Who the device remembers; the user of the session by default
    cached?: AuthUser | null;
}

// An in-memory stand-in for Better Auth's three routes, wired to the real auth store
function createFakeAuth(options: FakeAuthOptions = {}) {
    const session = options.session === undefined ? TEST_USER : options.session;
    const cached = options.cached === undefined ? session : options.cached;
    if (cached) writeCachedUser(cached);
    else clearCachedUser();

    const state = {
        session,
        // Makes every request fail like a dropped connection
        offline: false,
        // Makes the Google page unobtainable
        signInFails: false,
    };
    const calls = { getSession: 0, startSignIn: 0, signOut: 0 };
    const navigated: string[] = [];

    const service: AuthService = {
        getSession: async () => {
            calls.getSession++;
            if (state.offline) throw new TypeError('Failed to fetch');
            return state.session;
        },
        startSignIn: async () => {
            calls.startSignIn++;
            if (state.offline || state.signInFails) throw new TypeError('Failed to fetch');
            return 'https://accounts.google.com/test';
        },
        signOut: async () => {
            calls.signOut++;
            if (state.offline) throw new TypeError('Failed to fetch');
            state.session = null;
        },
    };

    return { auth: createAuth(service, (url) => navigated.push(url)), state, calls, navigated };
}

export { TEST_USER, createFakeAuth };
