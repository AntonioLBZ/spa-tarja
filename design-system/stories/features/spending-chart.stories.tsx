import { SpendingChart as SpendingChartComponent, type SpendingChartProps } from '@/features/charts/spending-chart';
import { GRANULARITIES, type Bucket, type Granularity } from '@core/charts';
import { addDays, startOfWeek } from '@core/date';
import { shiftMonth } from '@core/month';

import type { Meta } from '@storybook/react-vite';

const TODAY = '2026-10-29';

// A spread that is the same on every load: some days with nothing, some with a lot
const cents = (index: number) => ((index * 37) % 11) * 1450;

const BUCKETS: Record<Granularity, (count: number) => Bucket[]> = {
    day: (count) =>
        Array.from({ length: count }, (_, index) => ({
            start: addDays(TODAY, index - count + 1),
            totalCents: cents(index),
        })),
    week: (count) => {
        const first = startOfWeek(TODAY);

        return Array.from({ length: count }, (_, index) => ({
            start: addDays(first, (index - count + 1) * 7),
            totalCents: cents(index) * 4,
        }));
    },
    month: (count) =>
        Array.from({ length: count }, (_, index) => ({
            start: `${shiftMonth('2026-10', index - count + 1)}-01`,
            totalCents: cents(index) * 14,
        })),
};

interface SpendingChartStoryProps extends Omit<SpendingChartProps, 'buckets' | 'category'> {
    // How many days, weeks or months the chart holds
    count: number;
    nothingSpent: boolean;
    // The category the chart is narrowed to; empty for all of them
    category: string;
}

const Story: Meta<SpendingChartStoryProps> = {
    title: 'Features/SpendingChart',
    args: { granularity: 'day', today: TODAY, count: 30, nothingSpent: false, category: '' },
    argTypes: {
        granularity: { control: 'inline-radio', options: GRANULARITIES },
        today: { control: 'text' },
        category: { control: 'text' },
    },
};

export const SpendingChart = (args: SpendingChartStoryProps) => {
    const { count, nothingSpent, category, ...props } = args;
    const buckets = BUCKETS[props.granularity](count).map((bucket) =>
        nothingSpent ? { ...bucket, totalCents: 0 } : bucket
    );

    return <SpendingChartComponent {...props} buckets={buckets} category={category || null} />;
};

export default Story;
