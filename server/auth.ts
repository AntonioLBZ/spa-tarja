import { betterAuth, type BetterAuthOptions } from 'better-auth';

const SESSION_DAYS = 30;
const SESSION_CACHE_SECONDS = 5 * 60;

// Google is the only way in. `baseURL` is where the request came from.
function authOptions(env: Env, baseURL: string) {
    return {
        baseURL,
        secret: env.BETTER_AUTH_SECRET,
        database: env.DB,
        socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } },
        session: {
            expiresIn: SESSION_DAYS * 24 * 60 * 60,
            cookieCache: { enabled: true, maxAge: SESSION_CACHE_SECONDS },
        },
    } satisfies BetterAuthOptions;
}

function createAuth(env: Env, request: Request) {
    return betterAuth(authOptions(env, new URL(request.url).origin));
}

export { authOptions, createAuth };
