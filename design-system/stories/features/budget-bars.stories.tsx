import { BudgetBars as BudgetBarsComponent, type BudgetBarsProps } from '@/features/budgets/budget-bars';
import { TOTAL_SCOPE } from '@core/budget';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

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

interface BudgetBarsStoryProps extends BudgetBarsProps {
    // The limit in cents of the total and of each category; what is left out has none
    limits: Record<string, number>;
}

const Story: Meta<BudgetBarsStoryProps> = {
    title: 'Features/BudgetBars',
    args: {
        month: '2026-10',
        limits: { [TOTAL_SCOPE]: 100000, food: 30000, groceries: 40000, leisure: 20000, 'custom-pets': 4000 },
    },
    argTypes: { month: { control: 'text' } },
};

export const BudgetBars = (args: BudgetBarsStoryProps) => {
    const { month, limits } = args;
    const budgets = Object.entries(limits).map(([scope, amountCents]) => ({
        month,
        scope,
        amountCents,
        currency: 'EUR',
    }));

    return (
        <AppData
            key={`${month}:${JSON.stringify(limits)}`}
            api={{ categories: [...CUSTOM_CATEGORIES], expenses: EXPENSES, budgets }}
        >
            {() => <BudgetBarsComponent month={month} />}
        </AppData>
    );
};

export default Story;
