import { SpendingChart } from '@/features/charts/spending-chart';
import { addDays, startOfWeek } from '@core/date';
import { shiftMonth } from '@core/month';

import type { Bucket } from '@core/charts';
import type { Meta, StoryObj } from '@storybook/react-vite';

const TODAY = '2026-10-29';

// A spread that is the same on every load: some days with nothing, some with a lot
function cents(index: number) {
    return ((index * 37) % 11) * 1450;
}

function days(count: number): Bucket[] {
    return Array.from({ length: count }, (_, index) => ({
        start: addDays(TODAY, index - count + 1),
        totalCents: cents(index),
    }));
}

function weeks(count: number): Bucket[] {
    const first = startOfWeek(TODAY);
    return Array.from({ length: count }, (_, index) => ({
        start: addDays(first, (index - count + 1) * 7),
        totalCents: cents(index) * 4,
    }));
}

function months(count: number): Bucket[] {
    return Array.from({ length: count }, (_, index) => ({
        start: `${shiftMonth('2026-10', index - count + 1)}-01`,
        totalCents: cents(index) * 14,
    }));
}

const meta = {
    title: 'Features/SpendingChart',
    component: SpendingChart,
    args: { buckets: days(30), granularity: 'day', today: TODAY, category: null },
} satisfies Meta<typeof SpendingChart>;

type Story = StoryObj<typeof meta>;

const Days: Story = {};

const Weeks: Story = { args: { buckets: weeks(13), granularity: 'week' } };

const Months: Story = { args: { buckets: months(12), granularity: 'month' } };

const OneYearOfDays: Story = { args: { buckets: days(365) } };

const OneCategory: Story = { args: { category: 'Food' } };

const NothingSpent: Story = {
    args: { buckets: days(30).map((bucket) => ({ ...bucket, totalCents: 0 })) },
};

export default meta;
export { Days, Months, NothingSpent, OneCategory, OneYearOfDays, Weeks };
