import { cloudflareTest } from '@cloudflare/vitest-plugin';
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
