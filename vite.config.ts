import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { cloudflare } from '@cloudflare/vite-plugin';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { build, defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const prerelease = process.env.CLOUDFLARE_ENV === 'prerelease';

const PUSH_WORKER = 'push-worker.js';
const appName = prerelease ? 'Tarja Pre' : 'Tarja';
const iconFolder = prerelease ? 'prerelease/' : '';

const { version } = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as {
    version: string;
};

// The prerelease names the commit it was built from, since every push is a new build of the same version. Production
// leaves it out, so a push that changes no code builds the same files and asks nobody to update.
const commit = () => {
    if (!prerelease) return '';
    try {
        const sha = process.env.GITHUB_SHA ?? execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: 'pipe' });
        return sha.trim().slice(0, 7);
    } catch {
        return '';
    }
};

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

// The script the service worker imports for push notifications (ADR-0025), built on its own as a classic script, since
// a service worker that isn't a module can only import one
const pushWorker = (): Plugin => {
    return {
        name: 'tarja-push-worker',
        apply: 'build',
        applyToEnvironment: (environment) => environment.name === 'client',
        writeBundle: async (options) => {
            await build({
                configFile: false,
                logLevel: 'warn',
                resolve: { tsconfigPaths: true },
                build: {
                    outDir: options.dir,
                    emptyOutDir: false,
                    copyPublicDir: false,
                    lib: {
                        entry: fileURLToPath(new URL('./src/features/notices/push-worker.ts', import.meta.url)),
                        formats: ['iife'],
                        name: 'tarjaPush',
                        fileName: () => PUSH_WORKER,
                    },
                },
            });
        },
    };
};

export default defineConfig({
    plugins: [
        tanstackRouter({ target: 'react', autoCodeSplitting: true, routeFileIgnorePattern: '\\.test\\.tsx?$' }),
        react(),
        cloudflare(),
        prereleasePage(),
        pushWorker(),
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
                importScripts: [`/${PUSH_WORKER}`],
            },
        }),
    ],
    resolve: { tsconfigPaths: true },
    define: {
        'import.meta.env.VITE_PRERELEASE': JSON.stringify(String(prerelease)),
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
        'import.meta.env.VITE_APP_COMMIT': JSON.stringify(commit()),
    },
});
