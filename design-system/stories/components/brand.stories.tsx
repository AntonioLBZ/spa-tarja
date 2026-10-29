import { Brand } from '@/components/brand/brand';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Components/Brand',
    component: Brand,
    argTypes: { size: { control: 'inline-radio', options: ['header', 'hero'] } },
} satisfies Meta<typeof Brand>;

type Story = StoryObj<typeof meta>;

const Header: Story = { args: { size: 'header' } };

const Hero: Story = { args: { size: 'hero' } };

export default meta;
export { Header, Hero };
