import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { app } from './app';

describe('GET /api/health', () => {
    it('reports the database as reachable', async () => {
        const response = await app.request('/api/health', {}, env);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ ok: true });
    });
});
