import { SpendingStats } from '@/features/charts/spending-stats';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
    title: 'Features/SpendingStats',
    component: SpendingStats,
    args: {
        totalCents: 84210,
        partial: false,
        today: '2026-10-29',
        compared: {
            current: { from: '2026-10-01', to: '2026-10-29' },
            previous: { from: '2026-09-02', to: '2026-09-30' },
            currentCents: 84210,
            previousCents: 76000,
        },
    },
} satisfies Meta<typeof SpendingStats>;

type Story = StoryObj<typeof meta>;

const Up: Story = {};

const Down: Story = {
    args: {
        compared: {
            current: { from: '2026-10-01', to: '2026-10-29' },
            previous: { from: '2026-09-02', to: '2026-09-30' },
            currentCents: 52000,
            previousCents: 76000,
        },
    },
};

const PartialRange: Story = { args: { partial: true } };

const NothingToCompare: Story = { args: { compared: null } };

export default meta;
export { Down, NothingToCompare, PartialRange, Up };
