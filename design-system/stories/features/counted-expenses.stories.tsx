import {
    CountedExpenses as CountedExpensesComponent,
    type CountedExpensesProps,
} from '@/features/charts/counted-expenses';
import { countedExpenses } from '@core/charts';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

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

type CountedExpensesStoryProps = Pick<CountedExpensesProps, 'granularity'>;

const Story: Meta<CountedExpensesStoryProps> = {
    title: 'Features/CountedExpenses',
    args: { granularity: 'day' },
    argTypes: { granularity: { control: 'inline-radio', options: ['day', 'week', 'month'] } },
};

export const CountedExpenses = (args: CountedExpensesStoryProps) => {
    const { granularity } = args;
    const groups = countedExpenses(EXPENSES, {
        granularity,
        range: { from: '2026-10-01', to: '2026-10-31' },
        categoryId: null,
    });

    return (
        <AppData api={{ categories: [...CUSTOM_CATEGORIES] }}>
            {() => (
                <CountedExpensesComponent
                    groups={groups}
                    granularity={granularity}
                    pendingIds={new Set()}
                    sourceOf={() => undefined}
                />
            )}
        </AppData>
    );
};

export default Story;
