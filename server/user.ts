import { createMiddleware } from 'hono/factory';

import type { AppEnv } from '@server/env';

// Until the login exists every request is this user (ARCHITECTURE.md §8); the session replaces it here
const PROVISIONAL_USER_ID = 'provisional-user';

const withUser = createMiddleware<AppEnv>(async (c, next) => {
    c.set('userId', PROVISIONAL_USER_ID);
    await next();
});

export { PROVISIONAL_USER_ID, withUser };
