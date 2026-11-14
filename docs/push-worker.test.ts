import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { build, type InlineConfig } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';

const { PUSH_WORKER, pushWorkerBuild } = (await import(new URL('../push-worker.config.ts', import.meta.url).href)) as {
    PUSH_WORKER: string;
    pushWorkerBuild: (outDir: string) => InlineConfig;
};

const outDir = mkdtempSync(join(tmpdir(), 'push-worker-'));

afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
});

describe('the script of push notifications', () => {
    it('loads in a service worker, which has no process, and listens for pushes and taps', async () => {
        await build(pushWorkerBuild(outDir));
        const listened: string[] = [];
        const scope = {
            navigator: { userAgent: 'test' },
            addEventListener: (type: string) => listened.push(type),
        };

        runInNewContext(readFileSync(join(outDir, PUSH_WORKER), 'utf8'), { self: scope, ...scope });

        expect(listened.sort()).toEqual(['notificationclick', 'push']);
    }, 60_000);
});
