import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { budgetLimitsSchema } from '@core/budget';
import { monthSchema } from '@core/income';
import { listBudgets, saveBudgets } from '@server/db/budgets';

import type { AppEnv } from '@server/env';

const monthParam = sValidator('param', v.object({ month: monthSchema }));

const budgetsRoutes = new Hono<AppEnv>()
    .get('/', async (c) => c.json({ budgets: await listBudgets(c.env.DB, c.var.userId) }))
    .put('/:month', monthParam, sValidator('json', budgetLimitsSchema), async (c) => {
        const { month } = c.req.valid('param');
        return c.json({ budgets: await saveBudgets(c.env.DB, c.var.userId, month, c.req.valid('json')) }, 200);
    });

export { budgetsRoutes };
