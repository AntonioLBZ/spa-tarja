import { applyD1Migrations, type D1Migration } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach } from 'vitest';

// vitest.config.ts reads db/migrations in Node and hands them over as a binding
const { TEST_MIGRATIONS } = env as unknown as { TEST_MIGRATIONS: D1Migration[] };

await applyD1Migrations(env.DB, TEST_MIGRATIONS);

// Rows written by one test stay in the database, so each test starts from empty tables
beforeEach(async () => {
    await env.DB.prepare('DELETE FROM expenses').run();
    await env.DB.prepare('DELETE FROM categories').run();
    await env.DB.prepare('DELETE FROM income').run();
    await env.DB.prepare('DELETE FROM budget').run();
    for (const table of ['session', 'account', 'verification', 'user']) {
        await env.DB.prepare(`DELETE FROM "${table}"`).run();
    }
});
