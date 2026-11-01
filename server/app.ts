import { Hono } from 'hono';

import { createAuth } from '@server/auth';
import { withUser } from '@server/user';

import { budgetsRoutes } from './routes/budgets';
import { categoriesRoutes } from './routes/categories';
import { expensesRoutes } from './routes/expenses';
import { groupsRoutes } from './routes/groups';
import { incomeRoutes } from './routes/income';
import { profileRoutes } from './routes/profile';

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
    .use('/income/*', withUser)
    .use('/budgets/*', withUser)
    .use('/profile/*', withUser)
    .use('/groups/*', withUser)
    .route('/budgets', budgetsRoutes)
    .route('/categories', categoriesRoutes)
    .route('/expenses', expensesRoutes)
    .route('/groups', groupsRoutes)
    .route('/income', incomeRoutes)
    .route('/profile', profileRoutes);

type AppType = typeof app;

export { app, type AppType };
