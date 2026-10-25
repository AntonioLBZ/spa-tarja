import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        projects: [
            {
                plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
                test: {
                    name: 'server',
                    include: ['server/**/*.test.ts'],
                },
            },
            {
                plugins: [VitePWA({ disable: true })],
                resolve: { tsconfigPaths: true },
                test: {
                    name: 'front',
                    environment: 'jsdom',
                    include: ['src/**/*.test.{ts,tsx}'],
                    setupFiles: ['src/lib/test/setup.ts'],
                },
            },
        ],
    },
});
