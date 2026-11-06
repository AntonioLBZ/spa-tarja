import { createMiddleware } from 'hono/factory';

import { USER_HEADER } from '@core/account';
import { createAuth } from '@server/auth';

import type { AppEnv } from '@server/env';

const UNAUTHORIZED = { error: 'unauthorized' } as const;

// The window was opened for another user than the one the browser's cookie now carries
const OTHER_USER = { error: 'other-user' } as const;

// The rows a request may touch are the signed-in user's; without a session there is nothing to serve. The session may
// come from its cookie cache, which outlives an account deleted since, so the user is read on every request. A request
// that names the user it was made for must name the session's; one that names nobody (curl, an older app) is served.
const withUser = createMiddleware<AppEnv>(async (c, next) => {
    const session = await createAuth(c.env, c.req.raw).api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json(UNAUTHORIZED, 401);
    const user = await c.env.DB.prepare('SELECT 1 FROM "user" WHERE id = ?1').bind(session.user.id).first();
    if (!user) return c.json(UNAUTHORIZED, 401);
    const opened = c.req.header(USER_HEADER);
    if (opened !== undefined && opened !== session.user.id) return c.json(OTHER_USER, 401);
    c.set('userId', session.user.id);
    await next();
});

export { OTHER_USER, UNAUTHORIZED, withUser };
