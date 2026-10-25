import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { incomeInputSchema, monthSchema } from '@core/income';
import { deleteIncome, listIncome, saveIncome } from '@server/db/income';

import type { AppEnv } from '@server/env';

const monthParam = sValidator('param', v.object({ month: monthSchema }));

const incomeRoutes = new Hono<AppEnv>()
    .get('/', async (c) => c.json({ income: await listIncome(c.env.DB, c.var.userId) }))
    .put('/:month', monthParam, sValidator('json', incomeInputSchema), async (c) => {
        const { month } = c.req.valid('param');
        return c.json(await saveIncome(c.env.DB, c.var.userId, month, c.req.valid('json')), 200);
    })
    .delete('/:month', monthParam, async (c) => {
        await deleteIncome(c.env.DB, c.var.userId, c.req.valid('param').month);
        return c.body(null, 204);
    });

export { incomeRoutes };
