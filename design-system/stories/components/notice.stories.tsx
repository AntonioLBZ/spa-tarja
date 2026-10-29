import { Notice } from '@/components/notice/notice';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Components/Notice',
    component: Notice,
    args: { children: 'You are offline: changes are saved on this device and sent later.' },
    argTypes: { tone: { control: 'inline-radio', options: ['info', 'danger', 'quiet'] } },
} satisfies Meta<typeof Notice>;

type Story = StoryObj<typeof meta>;

const Info: Story = { args: { tone: 'info', role: 'status' } };

const Danger: Story = { args: { tone: 'danger', role: 'alert', children: 'The amount is not a number.' } };

const Quiet: Story = { args: { tone: 'quiet', children: 'Only what was added in the last 30 days.' } };

const Tones: Story = {
    render: () => (
        <div style={{ display: 'grid', gap: 'var(--size-4)' }}>
            <Notice tone="info">Ink for information.</Notice>
            <Notice tone="danger">The danger color for errors.</Notice>
            <Notice tone="quiet">A hairline for what is only background.</Notice>
        </div>
    ),
};

export default meta;
export { Danger, Info, Quiet, Tones };
