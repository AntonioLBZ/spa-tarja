import { betterAuth, type BetterAuthOptions } from 'better-auth';

const SESSION_DAYS = 30;
const SESSION_CACHE_SECONDS = 5 * 60;

// The app never calls Google after the sign-in, so none of the tokens it sends is kept
const withoutTokens = async () => ({ data: { accessToken: null, refreshToken: null, idToken: null } });

// Google is the only way in. `baseURL` is where the request came from (ADR-0008).
const authOptions = (env: Env, baseURL: string) => {
    return {
        baseURL,
        secret: env.BETTER_AUTH_SECRET,
        database: env.DB,
        socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } },
        session: {
            expiresIn: SESSION_DAYS * 24 * 60 * 60,
            cookieCache: { enabled: true, maxAge: SESSION_CACHE_SECONDS },
        },
        databaseHooks: { account: { create: { before: withoutTokens }, update: { before: withoutTokens } } },
    } satisfies BetterAuthOptions;
};

const createAuth = (env: Env, request: Request) => {
    return betterAuth(authOptions(env, new URL(request.url).origin));
};

export { authOptions, createAuth };
