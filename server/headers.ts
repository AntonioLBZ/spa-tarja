import { createMiddleware } from 'hono/factory';

// What every answer says to the browser: not to be framed by another page, the origin and not the path when a link
// leaves it, a file is what its type says, and no page that opens it keeps a hold on it. The answers are JSON and
// redirects, which load nothing, so the policy allows nothing but the style of the one page Better Auth writes (its
// error page). The static assets send the same ones, with the policy of the pages.
const SECURITY_HEADERS = [
    ['Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin'],
    ['X-Content-Type-Options', 'nosniff'],
    ['Cross-Origin-Opener-Policy', 'same-origin-allow-popups'],
] as const;

// `c.header` copies an answer that is finished already, so also one whose headers can't be changed (a redirect) takes
// them, and the cookies it sets stay as they are
const withSecurityHeaders = createMiddleware(async (c, next) => {
    await next();
    for (const [name, value] of SECURITY_HEADERS) c.header(name, value);
});

export { SECURITY_HEADERS, withSecurityHeaders };
