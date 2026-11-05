import { createMiddleware } from 'hono/factory';

import { createAuth } from '@server/auth';

import type { AppEnv } from '@server/env';

const UNAUTHORIZED = { error: 'unauthorized' } as const;

// The rows a request may touch are the signed-in user's; without a session there is nothing to serve. The session may
// come from its cookie cache, which outlives an account deleted since, so the user is read on every request.
const withUser = createMiddleware<AppEnv>(async (c, next) => {
    const session = await createAuth(c.env, c.req.raw).api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json(UNAUTHORIZED, 401);
    const user = await c.env.DB.prepare('SELECT 1 FROM "user" WHERE id = ?1').bind(session.user.id).first();
    if (!user) return c.json(UNAUTHORIZED, 401);
    c.set('userId', session.user.id);
    await next();
});

export { UNAUTHORIZED, withUser };
