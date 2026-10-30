import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
    framework: '@storybook/react-vite',
    stories: ['../stories/**/*.stories.tsx'],
    addons: ['@storybook/addon-a11y'],
    core: { disableTelemetry: true },
    features: { sidebarOnboardingChecklist: false, menuOnboardingChecklist: false },
    typescript: { reactDocgen: 'react-docgen' },
};

export default config;
