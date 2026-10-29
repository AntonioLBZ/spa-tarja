import { ChoiceGroup } from '@/components/choice-group/choice-group';
import { useState } from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

const OPTIONS = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
] as const;

function ChoiceGroupDemo() {
    const [value, setValue] = useState<(typeof OPTIONS)[number]['value']>('light');

    return <ChoiceGroup legend="Theme" name="theme" options={OPTIONS} value={value} onChange={setValue} />;
}

const meta = {
    title: 'Components/ChoiceGroup',
    render: () => <ChoiceGroupDemo />,
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

export default meta;
export { Default };
