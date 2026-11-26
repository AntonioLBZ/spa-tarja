import { SpendingStats } from '@/features/charts/spending-stats';

import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/SpendingStats',
    component: SpendingStats,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'dynamic' } } },
};

export const Basic = () => {
    return (
        <SpendingStats
            totalCents={84200}
            partial={false}
            today="2026-10-29"
            compared={{
                current: { from: '2026-10-01', to: '2026-10-29' },
                previous: { from: '2026-09-01', to: '2026-09-29' },
                currentCents: 84200,
                previousCents: 76000,
            }}
        />
    );
};

export const Less = () => {
    return (
        <SpendingStats
            totalCents={84200}
            partial={false}
            today="2026-10-29"
            compared={{
                current: { from: '2026-10-01', to: '2026-10-29' },
                previous: { from: '2026-09-01', to: '2026-09-29' },
                currentCents: 84200,
                previousCents: 91000,
            }}
        />
    );
};

export const Partial = () => {
    return (
        <SpendingStats
            totalCents={84200}
            partial
            today="2026-10-29"
            compared={{
                current: { from: '2026-10-01', to: '2026-10-29' },
                previous: { from: '2026-09-01', to: '2026-09-29' },
                currentCents: 84200,
                previousCents: 76000,
            }}
        />
    );
};

export const NotCompared = () => {
    return <SpendingStats totalCents={0} partial={false} today="2026-10-29" compared={null} />;
};

export const Category = () => {
    return (
        <SpendingStats
            totalCents={21000}
            partial={false}
            today="2026-10-29"
            category="Groceries"
            compared={{
                current: { from: '2026-10-01', to: '2026-10-29' },
                previous: { from: '2026-09-01', to: '2026-09-29' },
                currentCents: 21000,
                previousCents: 21000,
            }}
        />
    );
};

export default Story;
