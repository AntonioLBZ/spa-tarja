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
                // A manifest holds a single value: the dark --color-bg-secondary (Android paints its navigation bar
                // with it) and the light --color-bg-primary (the splash screen)
                theme_color: '#141414',
                background_color: '#fff',
                icons: [
                    { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
                    { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                // The fonts are part of the shell, so the app looks the same offline
                globPatterns: ['**/*.{js,css,html,woff2}'],
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api\//],
                cleanupOutdatedCaches: true,
            },
        }),
    ],
    resolve: { tsconfigPaths: true },
});
