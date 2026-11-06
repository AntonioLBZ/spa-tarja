import { createMiddleware } from 'hono/factory';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const AUTH_PATH = '/api/auth/';

const isOwnOrigin = (origin: string, requestUrl: string): boolean => {
    try {
        return new URL(origin).origin === new URL(requestUrl).origin;
    } catch {
        return false;
    }
};

// A browser sends `Origin` on every write, and a page on a sibling site can make a write with no body or custom header
// without a preflight (the cookie is `SameSite=Lax`, which sibling subdomains share). A write that names another origin,
// or the literal `null`, is refused; one with no `Origin` is not from a browser. Better Auth checks its own.
const withOwnOrigin = createMiddleware(async (c, next) => {
    const origin = c.req.header('Origin');
    if (
        origin !== undefined &&
        UNSAFE_METHODS.has(c.req.method) &&
        !c.req.path.startsWith(AUTH_PATH) &&
        !isOwnOrigin(origin, c.req.url)
    ) {
        return c.json({ error: 'bad-origin' }, 403);
    }
    await next();
});

export { withOwnOrigin };
