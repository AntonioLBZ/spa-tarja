import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { categoryIdSchema, categoryInputSchema } from '@core/category';
import { deleteCategory, listCategories, saveCategory } from '@server/db/categories';

import type { AppEnv } from '@server/env';

const idParam = sValidator('param', v.object({ id: categoryIdSchema }));

const categoriesRoutes = new Hono<AppEnv>()
    .get('/', async (c) => c.json({ categories: await listCategories(c.env.DB, c.var.userId) }))
    .put('/:id', idParam, sValidator('json', categoryInputSchema), async (c) => {
        const { id } = c.req.valid('param');
        const input = c.req.valid('json');

        const result = await saveCategory(c.env.DB, c.var.userId, id, input);
        if ('error' in result) return c.json({ error: result.error }, 409);
        return c.json(result.category, 200);
    })
    .delete('/:id', idParam, async (c) => {
        await deleteCategory(c.env.DB, c.var.userId, c.req.valid('param').id);
        return c.body(null, 204);
    });

export { categoriesRoutes };
