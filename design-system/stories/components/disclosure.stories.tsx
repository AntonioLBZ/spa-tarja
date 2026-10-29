import { Disclosure } from '@/components/disclosure/disclosure';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Components/Disclosure',
    component: Disclosure,
    args: { summary: 'Filters', children: <p style={{ margin: 0 }}>What the panel holds.</p> },
} satisfies Meta<typeof Disclosure>;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

const Open: Story = { args: { defaultOpen: true } };

const Chevron: Story = { args: { chevron: true } };

const AsHeading: Story = { args: { heading: 'h2', chevron: true, defaultOpen: true } };

const Disabled: Story = { args: { disabled: true } };

const KeepMounted: Story = {
    args: {
        keepMounted: true,
        summary: 'Keeps what was typed',
        children: <input aria-label="Note" type="text" defaultValue="Still here after closing" />,
    },
};

export default meta;
export { AsHeading, Chevron, Default, Disabled, KeepMounted, Open };
