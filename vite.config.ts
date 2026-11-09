import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const prerelease = process.env.CLOUDFLARE_ENV === 'prerelease';
const appName = prerelease ? 'Tarja Pre' : 'Tarja';
const iconFolder = prerelease ? 'prerelease/' : '';

// The prerelease build points the icons and the title of the page at its own
const prereleasePage = (): Plugin => {
    const swaps: [string, string][] = [
        ['href="/favicon.ico"', 'href="/prerelease/favicon.ico"'],
        ['href="/favicon.svg"', 'href="/prerelease/favicon.svg"'],
        ['href="/apple-touch-icon-180x180.png"', 'href="/prerelease/apple-touch-icon-180x180.png"'],
        ['<title>Tarja</title>', '<title>Tarja Pre</title>'],
    ];

    return {
        name: 'tarja-prerelease-page',
        transformIndexHtml: (html) => {
            if (!prerelease) return html;
            return swaps.reduce((page, [from, to]) => {
                if (!page.includes(from)) throw new Error(`index.html no longer holds ${from}`);
                return page.replace(from, to);
            }, html);
        },
    };
};

export default defineConfig({
    plugins: [
        tanstackRouter({ target: 'react', autoCodeSplitting: true, routeFileIgnorePattern: '\\.test\\.tsx?$' }),
        react(),
        cloudflare(),
        prereleasePage(),
        VitePWA({
            // The new version waits for the user, so an update never reloads the app halfway through an expense
            registerType: 'prompt',
            includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'].map(
                (file) => iconFolder + file
            ),
            manifest: {
                name: appName,
                short_name: appName,
                description: 'Log your everyday expenses: food, groceries, leisure, bills and rent.',
                start_url: '/',
                scope: '/',
                display: 'standalone',
                // A manifest holds a single value: the dark --color-bg-secondary (Android paints its navigation bar
                // with it) and the light --color-bg-primary (the splash screen)
                theme_color: '#141414',
                background_color: '#fff',
                icons: [
                    { src: iconFolder + 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
                    { src: iconFolder + 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: iconFolder + 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                    {
                        src: iconFolder + 'maskable-icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
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
    define: { 'import.meta.env.VITE_PRERELEASE': JSON.stringify(String(prerelease)) },
});
