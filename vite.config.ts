import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        tanstackRouter({ target: 'react', autoCodeSplitting: true, routeFileIgnorePattern: '\\.test\\.tsx?$' }),
        react(),
        cloudflare(),
        VitePWA({
            // The new version waits for the user, so an update never reloads the app halfway through an expense
            registerType: 'prompt',
            includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
            manifest: {
                name: 'Tarja',
                short_name: 'Tarja',
                description: 'Log your everyday expenses: food, groceries, leisure, bills and rent.',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                // Light values of --color-bg-secondary and --color-bg-primary; a manifest holds a single value
                theme_color: '#f4f4f4',
                background_color: '#fff',
                icons: [
                    { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api\//],
                cleanupOutdatedCaches: true,
            },
        }),
    ],
    resolve: { tsconfigPaths: true },
});
