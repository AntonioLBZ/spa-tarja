// The secrets: `.dev.vars` locally (see `.dev.vars.example`), `wrangler secret` in production.
// Declared on both `Env` interfaces that `wrangler types` leaves: the global one and the one of `cloudflare:workers`.
interface Env {
    BETTER_AUTH_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    // The key that signs pushes, a JWK of P-256; without it there are no push notifications
    VAPID_PRIVATE_KEY?: string;
    // Who runs the server, as a `mailto:`, which the push services may write to
    VAPID_SUBJECT?: string;
}

declare namespace Cloudflare {
    interface Env {
        BETTER_AUTH_SECRET: string;
        GOOGLE_CLIENT_ID: string;
        GOOGLE_CLIENT_SECRET: string;
        // The key that signs pushes, a JWK of P-256; without it there are no push notifications
        VAPID_PRIVATE_KEY?: string;
        // Who runs the server, as a `mailto:`, which the push services may write to
        VAPID_SUBJECT?: string;
    }
}
