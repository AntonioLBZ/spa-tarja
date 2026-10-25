import { createMiddleware } from 'hono/factory';

import { createAuth } from '@server/auth';

import type { AppEnv } from '@server/env';

// The rows a request may touch are the signed-in user's; without a session there is nothing to serve
const withUser = createMiddleware<AppEnv>(async (c, next) => {
    const session = await createAuth(c.env, c.req.raw).api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: 'unauthorized' }, 401);
    c.set('userId', session.user.id);
    await next();
});

export { withUser };
