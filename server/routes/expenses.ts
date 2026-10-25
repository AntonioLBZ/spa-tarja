import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { isDefaultCategoryId } from '@core/categories';
import { expenseIdSchema, expenseInputSchema } from '@core/expense';
import { listChanges, upsertExpense } from '@server/db/expenses';

import type { AppEnv } from '@server/env';

const DEFAULT_PAGE_SIZE = 200;
const MAX_PAGE_SIZE = 500;

const count = v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number), v.safeInteger());

const changesQuery = v.object({
    after: v.optional(count),
    limit: v.optional(v.pipe(count, v.minValue(1), v.maxValue(MAX_PAGE_SIZE))),
});

const expensesRoutes = new Hono<AppEnv>()
    .get('/', sValidator('query', changesQuery), async (c) => {
        const { after = 0, limit = DEFAULT_PAGE_SIZE } = c.req.valid('query');
        return c.json(await listChanges(c.env.DB, c.var.userId, after, limit));
    })
    .put(
        '/:id',
        sValidator('param', v.object({ id: expenseIdSchema })),
        sValidator('json', expenseInputSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const input = c.req.valid('json');

            if (!isDefaultCategoryId(input.categoryId)) return c.json({ error: 'unknown-category' }, 400);

            const expense = await upsertExpense(c.env.DB, c.var.userId, id, input);
            if (!expense) return c.json({ error: 'id-taken' }, 409);
            return c.json(expense, 200);
        }
    );

export { expensesRoutes };
