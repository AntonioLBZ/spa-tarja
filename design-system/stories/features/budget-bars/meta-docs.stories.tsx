import { BudgetBars } from '@/features/budgets/budget-bars';
import { TOTAL_SCOPE } from '@core/budgets/budget';
import { sampleExpense, withAppData } from '@stories/shared/app-data';
import { CUSTOM_CATEGORIES } from '@stories/shared/fixtures';

import type { Meta } from '@storybook/react-vite';

const EXPENSES = [
    sampleExpense('22222222-2222-4222-8222-222222222221', '2026-10-03', { categoryId: 'food', amountCents: 21000 }),
    sampleExpense('22222222-2222-4222-8222-222222222222', '2026-10-09', { categoryId: 'food', amountCents: 12500 }),
    sampleExpense('22222222-2222-4222-8222-222222222223', '2026-10-12', {
        categoryId: 'groceries',
        amountCents: 31000,
    }),
    sampleExpense('22222222-2222-4222-8222-222222222224', '2026-10-15', { categoryId: 'leisure', amountCents: 8000 }),
    sampleExpense('22222222-2222-4222-8222-222222222225', '2026-10-20', { categoryId: 'bills', amountCents: 5200 }),
    sampleExpense('22222222-2222-4222-8222-222222222226', '2026-10-21', {
        categoryId: 'custom-pets',
        amountCents: 4200,
    }),
];

const LIMITS = (
    [
        [TOTAL_SCOPE, 1000],
        ['food', 300],
        ['groceries', 400],
        ['custom-pets', 40],
    ] as const
).map(([scope, euros]) => ({ month: '2026-10', scope, amountCents: euros * 100, currency: 'EUR' }));

const Story: Meta = {
    title: 'Features/BudgetBars',
    component: BudgetBars,
    tags: ['!dev'],
    decorators: [withAppData],
    parameters: {
        docs: { source: { type: 'dynamic' }, story: { inline: false, iframeHeight: 360 } },
        appData: { categories: [...CUSTOM_CATEGORIES], expenses: EXPENSES, budgets: LIMITS },
    },
};

export const Basic = () => {
    return <BudgetBars month="2026-10" />;
};

export default Story;
