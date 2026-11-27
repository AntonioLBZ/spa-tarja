import { readFileSync } from 'node:fs';

import type { StorybookConfig } from '@storybook/react-vite';

const tokensCss = readFileSync(new URL('../../src/assets/styles/tokens.css', import.meta.url), 'utf8');
const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
};

// The favicon, the faces of the frame, the logo of the sidebar header and the version of the app (ADR-0046)
const MANAGER_HEAD = `
<link rel="icon" type="image/svg+xml" href="./favicon.svg" />
<script>
    window.TARJA_TOKENS_CSS = ${JSON.stringify(tokensCss).replaceAll('<', '\\u003c')};
    window.TARJA_VERSION = ${JSON.stringify(version).replaceAll('<', '\\u003c')};
</script>
<style>
    @font-face {
        font-display: swap;
        font-family: 'IBM Plex Mono';
        font-weight: 400;
        src: url('./fonts/plex/ibm-plex-mono-latin-400-normal.woff2') format('woff2');
    }
    @font-face {
        font-display: swap;
        font-family: 'IBM Plex Mono';
        font-weight: 700;
        src: url('./fonts/plex/ibm-plex-mono-latin-700-normal.woff2') format('woff2');
    }
    @font-face {
        font-display: swap;
        font-family: 'Dot Matrix';
        font-weight: 400;
        src: url('./fonts/brand/dot-matrix.woff2') format('woff2');
    }
    .tarja-brand {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }
    .tarja-brand__name {
        font-family: 'Dot Matrix', 'IBM Plex Mono', monospace;
        font-size: 1.44rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }
    .tarja-brand__tagline {
        font-size: 0.833rem;
        font-weight: 400;
    }
</style>
`;

const config: StorybookConfig = {
    framework: '@storybook/react-vite',
    stories: ['../stories/**/*.mdx', '../stories/**/*.stories.tsx'],
    addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
    staticDirs: [
        '../public',
        { from: '../../src/assets/fonts', to: '/fonts/brand' },
        { from: '../../node_modules/@fontsource/ibm-plex-mono/files', to: '/fonts/plex' },
    ],
    managerHead: (head) => `${head}${MANAGER_HEAD}`,
    core: { disableTelemetry: true },
    features: { sidebarOnboardingChecklist: false, menuOnboardingChecklist: false },
    typescript: { reactDocgen: 'react-docgen' },
};

export default config;
