import { SpendingStats as SpendingStatsComponent, type SpendingStatsProps } from '@/features/charts/spending-stats';

import type { Meta } from '@storybook/react-vite';

const Story: Meta<SpendingStatsProps> = {
    title: 'Features/SpendingStats',
    component: SpendingStatsComponent,
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
    argTypes: { today: { control: 'text' } },
};

export const SpendingStats = (args: SpendingStatsProps) => {
    return <SpendingStatsComponent {...args} />;
};

export default Story;
