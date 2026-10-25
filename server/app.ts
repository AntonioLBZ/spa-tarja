import { Hono } from 'hono';

// Chained so `typeof app` carries the route types to the SPA's `hc` client
const app = new Hono<{ Bindings: Env }>().basePath('/api').get('/health', async (c) => {
    const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    return c.json({ ok: row?.ok === 1 });
});

type AppType = typeof app;

export { app };
export type { AppType };
