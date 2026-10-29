import { Account } from '@/features/auth/account';

import { AppData } from './app-data';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Features/Account',
    render: () => <AppData>{() => <Account />}</AppData>,
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

export default meta;
export { Default };
