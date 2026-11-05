import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';

import { accountDeletionSchema, confirmsEmail } from '@core/account';
import { createAuth } from '@server/auth';
import { deleteAccount, readEmail } from '@server/db/account';
import { UNAUTHORIZED } from '@server/user';

import type { AppEnv } from '@server/env';

// Deleting the account, which takes its own email to confirm. The answer says nothing but that it is done.
const accountRoutes = new Hono<AppEnv>().delete('/', sValidator('json', accountDeletionSchema), async (c) => {
    const email = await readEmail(c.env.DB, c.var.userId);
    if (email === null) return c.json(UNAUTHORIZED, 401);
    if (!confirmsEmail(c.req.valid('json').email, email)) return c.json({ error: 'wrong-email' }, 422);

    await deleteAccount(c.env.DB, c.var.userId);
    // Better Auth's own sign-out expires its cookies; the session itself is gone already. The account is gone whatever
    // this does, so a failure here leaves a cookie of a session that answers 401, not a failed deletion.
    try {
        const { headers } = await createAuth(c.env, c.req.raw).api.signOut({
            headers: c.req.raw.headers,
            returnHeaders: true,
        });
        for (const cookie of headers.getSetCookie()) c.header('Set-Cookie', cookie, { append: true });
    } catch {
        // Nothing to expire
    }
    return c.body(null, 204);
});

export { accountRoutes };
