// The secrets: `.dev.vars` locally (see `.dev.vars.example`), `wrangler secret` in production.
// Declared on both `Env` interfaces that `wrangler types` leaves: the global one and the one of `cloudflare:workers`.
interface Env {
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
}

declare namespace Cloudflare {
    interface Env {
        BETTER_AUTH_SECRET: string;
        GOOGLE_CLIENT_ID: string;
        GOOGLE_CLIENT_SECRET: string;
    }
}
