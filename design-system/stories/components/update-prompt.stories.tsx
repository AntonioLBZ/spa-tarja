import { UpdatePrompt } from '@/components/update-prompt/update-prompt';
import { useTranslations } from 'use-intl';

import type { Meta, StoryObj } from '@storybook/react-vite';

// With the copy of the app, in the chosen language
function UpdatePromptDemo() {
    const t = useTranslations('pwa.update');

    return (
        <UpdatePrompt
            message={t('message')}
            labels={{ apply: t('apply'), dismiss: t('dismiss') }}
            onApply={() => undefined}
            onDismiss={() => undefined}
        />
    );
}

const meta = {
    title: 'Components/UpdatePrompt',
    parameters: { layout: 'fullscreen' },
    render: () => <UpdatePromptDemo />,
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

export default meta;
export { Default };
