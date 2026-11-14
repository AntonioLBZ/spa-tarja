import { Hono } from 'hono';

import { createAuth } from '@server/auth';
import { withFramingHeaders } from '@server/headers';
import { withOwnOrigin } from '@server/origin';
import { withUser } from '@server/user';

import { accountRoutes } from './routes/account';
import { budgetsRoutes } from './routes/budgets';
import { categoriesRoutes } from './routes/categories';
import { entriesRoutes } from './routes/entries';
import { expensesRoutes } from './routes/expenses';
import { groupsRoutes } from './routes/groups';
import { incomeRoutes } from './routes/income';
import { invitationsRoutes } from './routes/invitations';
import { membersRoutes } from './routes/members';
import { profileRoutes } from './routes/profile';
import { pushRoutes } from './routes/push';

import type { AppEnv } from '@server/env';

// Chained so `typeof app` carries the route types to the SPA's `hc` client
const app = new Hono<AppEnv>()
    .basePath('/api')
    .use(withFramingHeaders)
    .use(withOwnOrigin)
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
    .use('/invitations/*', withUser)
    .use('/account/*', withUser)
    .use('/push/*', withUser)
    .route('/account', accountRoutes)
    .route('/budgets', budgetsRoutes)
    .route('/categories', categoriesRoutes)
    .route('/expenses', expensesRoutes)
    .route('/groups', groupsRoutes)
    .route('/groups', membersRoutes)
    .route('/groups', entriesRoutes)
    .route('/income', incomeRoutes)
    .route('/invitations', invitationsRoutes)
    .route('/profile', profileRoutes)
    .route('/push', pushRoutes);

type AppType = typeof app;

export { app, type AppType };
