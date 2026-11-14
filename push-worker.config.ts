import { fileURLToPath } from 'node:url';

import type { InlineConfig } from 'vite';

const PUSH_WORKER = 'push-worker.js';

// The script the service worker imports for push notifications (ADR-0025), built on its own as a classic script, since
// a service worker that isn't a module can only import one
const pushWorkerBuild = (outDir: string): InlineConfig => {
    return {
        configFile: false,
        logLevel: 'warn',
        resolve: { tsconfigPaths: true },
        // A library build leaves this in, and a service worker has no `process`
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        build: {
            outDir,
            emptyOutDir: false,
            copyPublicDir: false,
            lib: {
                entry: fileURLToPath(new URL('./src/features/notices/push-worker.ts', import.meta.url)),
                formats: ['iife'],
                name: 'tarjaPush',
                fileName: () => PUSH_WORKER,
            },
        },
    };
};

export { PUSH_WORKER, pushWorkerBuild };
