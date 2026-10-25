import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const migrations = await readD1Migrations('db/migrations');

export default defineConfig({
    test: {
        projects: [
            {
                resolve: { tsconfigPaths: true },
                test: {
                    name: 'core',
                    environment: 'node',
                    include: ['core/**/*.test.ts'],
                },
            },
            {
                plugins: [
                    cloudflareTest({
                        wrangler: { configPath: './wrangler.jsonc' },
                        miniflare: {
                            bindings: {
                                TEST_MIGRATIONS: migrations,
                                BETTER_AUTH_SECRET: 'test-secret-that-is-long-enough-for-better-auth',
                                GOOGLE_CLIENT_ID: 'test-client-id',
                                GOOGLE_CLIENT_SECRET: 'test-client-secret',
                            },
                        },
                    }),
                ],
                resolve: { tsconfigPaths: true },
                test: {
                    name: 'server',
                    include: ['server/**/*.test.ts'],
                    setupFiles: ['server/test/apply-migrations.ts'],
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
