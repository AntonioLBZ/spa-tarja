import { CountedExpenses } from '@/features/charts/counted-expenses';
import { countedExpenses } from '@core/reports/charts';
import { sampleExpense, withAppData } from '@stories/shared/app-data';
import { CUSTOM_CATEGORIES } from '@stories/shared/fixtures';

import type { Meta } from '@storybook/react-vite';

const EXPENSES = [
    sampleExpense('22222222-2222-4222-8222-222222222221', '2026-10-25', { text: 'Coffee', amountCents: 300 }),
    sampleExpense('22222222-2222-4222-8222-222222222222', '2026-10-25', {
        categoryId: 'groceries',
        text: 'Weekly shop',
        amountCents: 4599,
    }),
    sampleExpense('22222222-2222-4222-8222-222222222223', '2026-09-28', {
        categoryId: 'leisure',
        text: 'Concert tickets',
        amountCents: 6400,
        payment: 'credit',
        chargeDate: '2026-10-24',
    }),
    sampleExpense('22222222-2222-4222-8222-222222222224', '2026-10-05', {
        categoryId: 'housing',
        text: 'Sofa',
        amountCents: 10000,
        payment: 'credit',
        chargeDate: '2026-10-24',
        plan: { id: '2a8f6a52-6d4a-4f0e-9d7b-3b8f5f5e3c12', part: 2, parts: 3 },
    }),
    sampleExpense('22222222-2222-4222-8222-222222222225', '2026-10-10', {
        categoryId: 'custom-pets',
        text: 'Vet',
        amountCents: 4200,
    }),
];

const OCTOBER = { from: '2026-10-01', to: '2026-10-31' };

const Story: Meta = {
    title: 'Features/CountedExpenses',
    component: CountedExpenses,
    tags: ['!dev'],
    decorators: [withAppData],
    parameters: {
        docs: { source: { type: 'code' }, story: { inline: false, iframeHeight: 520 } },
        appData: { categories: [...CUSTOM_CATEGORIES] },
    },
};

export const Basic = () => {
    const groups = countedExpenses(EXPENSES, { granularity: 'day', range: OCTOBER, categoryId: null });

    return <CountedExpenses groups={groups} granularity="day" pendingIds={new Set()} sourceOf={() => undefined} />;
};

export const ByMonth = () => {
    const groups = countedExpenses(EXPENSES, { granularity: 'month', range: OCTOBER, categoryId: null });

    return <CountedExpenses groups={groups} granularity="month" pendingIds={new Set()} sourceOf={() => undefined} />;
};

export default Story;
