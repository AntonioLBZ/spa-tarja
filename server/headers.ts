import { createMiddleware } from 'hono/factory';

// What keeps the app from being framed by another page, and sends the origin and not the path when a link leaves it.
// The static assets send the same ones.
const FRAMING_HEADERS = [
    ['Content-Security-Policy', "frame-ancestors 'none'"],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin'],
] as const;

// `c.header` copies an answer that is finished already, so also one whose headers can't be changed (a redirect) takes
// them, and the cookies it sets stay as they are
const withFramingHeaders = createMiddleware(async (c, next) => {
    await next();
    for (const [name, value] of FRAMING_HEADERS) c.header(name, value);
});

export { withFramingHeaders };
