import { Hono } from 'hono';

import { withUser } from '@server/user';

import { expensesRoutes } from './routes/expenses';

import type { AppEnv } from '@server/env';

// Chained so `typeof app` carries the route types to the SPA's `hc` client
const app = new Hono<AppEnv>()
    .basePath('/api')
    .use(withUser)
    .get('/health', async (c) => {
        const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
        return c.json({ ok: row?.ok === 1 });
    })
    .route('/expenses', expensesRoutes);

type AppType = typeof app;

export { app };
export type { AppType };
