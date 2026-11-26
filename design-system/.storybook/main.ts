import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
    framework: '@storybook/react-vite',
    stories: ['../stories/**/*.mdx', '../stories/**/*.stories.tsx'],
    addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
    core: { disableTelemetry: true },
    features: { sidebarOnboardingChecklist: false, menuOnboardingChecklist: false },
    typescript: { reactDocgen: 'react-docgen' },
};

export default config;
