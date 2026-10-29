import { CategoryBadge } from '@/features/categories/category-badge';
import { CATEGORY_COLORS } from '@core/category-style';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Features/CategoryBadge',
    component: CategoryBadge,
    args: { style: { color: 'vermillion', icon: 'restaurant' } },
} satisfies Meta<typeof CategoryBadge>;

type Story = StoryObj<typeof meta>;

const Default: Story = {};

const Colors: Story = {
    render: () => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--size-4)', fontSize: 'var(--font-size-xl)' }}>
            {CATEGORY_COLORS.map((color) => (
                <CategoryBadge key={color} style={{ color, icon: 'category' }} />
            ))}
        </div>
    ),
};

export default meta;
export { Colors, Default };
