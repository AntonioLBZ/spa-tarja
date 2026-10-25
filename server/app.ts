import { Hono } from 'hono';

import { createAuth } from '@server/auth';
import { withUser } from '@server/user';

import { categoriesRoutes } from './routes/categories';
import { expensesRoutes } from './routes/expenses';

import type { AppEnv } from '@server/env';

// Chained so `typeof app` carries the route types to the SPA's `hc` client
const app = new Hono<AppEnv>()
    .basePath('/api')
    .get('/health', async (c) => {
        const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
        return c.json({ ok: row?.ok === 1 });
    })
    .on(['GET', 'POST'], '/auth/*', (c) => createAuth(c.env, c.req.raw).handler(c.req.raw))
    .use('/expenses/*', withUser)
    .use('/categories/*', withUser)
    .route('/categories', categoriesRoutes)
    .route('/expenses', expensesRoutes);

type AppType = typeof app;

export { app };
export type { AppType };
