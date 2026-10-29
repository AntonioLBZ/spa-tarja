import { Button } from '@/components/button/button';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Components/Button',
    component: Button,
    args: { children: 'Save' },
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

export default meta;
export { Default };
