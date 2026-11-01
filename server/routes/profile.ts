import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';

import { profileInputSchema } from '@core/profile';
import { readProfile, saveProfile } from '@server/db/profile';

import type { AppEnv } from '@server/env';

const profileRoutes = new Hono<AppEnv>()
    .get('/', async (c) => c.json(await readProfile(c.env.DB, c.var.userId)))
    .put('/', sValidator('json', profileInputSchema), async (c) => {
        return c.json(await saveProfile(c.env.DB, c.var.userId, c.req.valid('json')), 200);
    });

export { profileRoutes };
