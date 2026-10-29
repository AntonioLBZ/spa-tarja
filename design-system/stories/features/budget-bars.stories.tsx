import { BudgetBars } from '@/features/budgets/budget-bars';
import { TOTAL_SCOPE } from '@core/budget';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Meta, StoryObj } from '@storybook/react-vite';

const MONTH = '2026-10';

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

function limit(scope: string, amountCents: number) {
    return { month: MONTH, scope, amountCents, currency: 'EUR' };
}

function Bars(props: { limits: ReturnType<typeof limit>[] }) {
    const { limits } = props;

    return (
        <AppData api={{ categories: [...CUSTOM_CATEGORIES], expenses: EXPENSES, budgets: limits }}>
            {() => <BudgetBars month={MONTH} />}
        </AppData>
    );
}

const meta = {
    title: 'Features/BudgetBars',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

// Under the limit, near it and over it
const Mixed: Story = {
    render: () => (
        <Bars
            limits={[
                limit(TOTAL_SCOPE, 100000),
                limit('food', 30000),
                limit('groceries', 40000),
                limit('leisure', 20000),
                limit('custom-pets', 4000),
            ]}
        />
    ),
};

const OnlyTheTotal: Story = {
    render: () => <Bars limits={[limit(TOTAL_SCOPE, 150000)]} />,
};

export default meta;
export { Mixed, OnlyTheTotal };
