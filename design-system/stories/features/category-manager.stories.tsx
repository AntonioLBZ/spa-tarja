import { CategoryManager } from '@/features/categories/category-manager';

import { AppData } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Features/CategoryManager',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const WithTheirOwn: Story = {
    render: () => <AppData api={{ categories: [...CUSTOM_CATEGORIES] }}>{() => <CategoryManager />}</AppData>,
};

const OnlyTheDefaults: Story = {
    render: () => <AppData api={{ categories: [] }}>{() => <CategoryManager />}</AppData>,
};

export default meta;
export { OnlyTheDefaults, WithTheirOwn };
