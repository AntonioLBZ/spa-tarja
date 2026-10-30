import { UpdatePrompt as UpdatePromptComponent, type UpdatePromptProps } from '@/features/pwa/update-prompt';
import { fn } from 'storybook/test';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<UpdatePromptProps> = {
    title: 'Features/UpdatePrompt',
    component: UpdatePromptComponent,
    args: {
        message: 'A new version is ready',
        labels: { apply: 'Update', dismiss: 'Later' },
        onApply: fn(),
        onDismiss: fn(),
    },
    parameters: { layout: 'fullscreen' },
};

export const UpdatePrompt = (args: UpdatePromptProps) => {
    return <UpdatePromptComponent {...args} />;
};

export default Story;
