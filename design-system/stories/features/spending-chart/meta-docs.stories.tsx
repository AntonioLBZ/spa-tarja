import { SpendingChart } from '@/features/charts/spending-chart';
import { addDays, startOfWeek } from '@core/basics/date';
import { shiftMonth } from '@core/basics/month';

import type { Bucket } from '@core/reports/charts';
import type { Meta } from '@storybook/react-vite';

const Story: Meta = {
    title: 'Features/SpendingChart',
    component: SpendingChart,
    tags: ['!dev'],
    parameters: { docs: { source: { type: 'code' } } },
};

const TODAY = '2026-10-29';

// A spread that is the same on every load: some days with nothing, some with a lot
const cents = (index: number) => ((index * 37) % 11) * 1450;

const days = (count: number): Bucket[] =>
    Array.from({ length: count }, (_, index) => ({
        start: addDays(TODAY, index - count + 1),
        totalCents: cents(index),
    }));

const weeks = (count: number): Bucket[] =>
    Array.from({ length: count }, (_, index) => ({
        start: addDays(startOfWeek(TODAY), (index - count + 1) * 7),
        totalCents: cents(index) * 4,
    }));

const months = (count: number): Bucket[] =>
    Array.from({ length: count }, (_, index) => ({
        start: `${shiftMonth('2026-10', index - count + 1)}-01`,
        totalCents: cents(index) * 14,
    }));

export const Basic = () => {
    return <SpendingChart granularity="day" today={TODAY} buckets={days(30)} category={null} />;
};

export const ByWeek = () => {
    return <SpendingChart granularity="week" today={TODAY} buckets={weeks(12)} category={null} />;
};

export const ByMonth = () => {
    return <SpendingChart granularity="month" today={TODAY} buckets={months(12)} category={null} />;
};

export const AFew = () => {
    return <SpendingChart granularity="day" today={TODAY} buckets={days(5)} category={null} />;
};

export const NothingSpent = () => {
    const buckets = days(30).map((bucket) => ({ ...bucket, totalCents: 0 }));

    return <SpendingChart granularity="day" today={TODAY} buckets={buckets} category={null} />;
};

export const Category = () => {
    return <SpendingChart granularity="day" today={TODAY} buckets={days(30)} category="Groceries" />;
};

export default Story;
