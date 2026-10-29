import { CardList } from '@/components/card/card';
import { ExpenseRow } from '@/features/expenses/expense-row';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Expense } from '@core/expense';
import type { Meta, StoryObj } from '@storybook/react-vite';

const PLAN_ID = '2a8f6a52-6d4a-4f0e-9d7b-3b8f5f5e3c11';

const noop = () => undefined;

function Row(props: {
    expenses: Expense[];
    isPlan?: boolean;
    pending?: boolean;
    leaving?: boolean;
    showDate?: boolean;
}) {
    const { expenses, isPlan = false, pending = false, leaving = false, showDate } = props;

    return (
        <AppData api={{ categories: [...CUSTOM_CATEGORIES] }}>
            {() => (
                <CardList flush>
                    <ExpenseRow
                        expenses={expenses}
                        isPlan={isPlan}
                        pending={pending}
                        leaving={leaving}
                        showDate={showDate}
                        onEdit={noop}
                        onDuplicate={noop}
                        onDelete={noop}
                    />
                </CardList>
            )}
        </AppData>
    );
}

const meta = {
    title: 'Features/ExpenseRow',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const day = '2026-10-27';

const Direct: Story = {
    render: () => <Row expenses={[sampleExpense('11111111-1111-4111-8111-111111111111', day)]} />,
};

const NoText: Story = {
    render: () => <Row expenses={[sampleExpense('11111111-1111-4111-8111-111111111112', day, { text: '' })]} />,
};

const CustomCategory: Story = {
    render: () => (
        <Row
            expenses={[
                sampleExpense('11111111-1111-4111-8111-111111111113', day, {
                    categoryId: 'custom-pets',
                    text: 'Vet',
                    amountCents: 4200,
                }),
            ]}
        />
    ),
};

const Pending: Story = {
    render: () => <Row pending expenses={[sampleExpense('11111111-1111-4111-8111-111111111114', day)]} />,
};

const Leaving: Story = {
    render: () => <Row leaving expenses={[sampleExpense('11111111-1111-4111-8111-111111111115', day)]} />,
};

const WithTheDay: Story = {
    render: () => <Row showDate expenses={[sampleExpense('11111111-1111-4111-8111-111111111116', day)]} />,
};

const Credit: Story = {
    render: () => (
        <Row
            expenses={[
                sampleExpense('11111111-1111-4111-8111-111111111117', day, {
                    categoryId: 'leisure',
                    text: 'Concert tickets',
                    amountCents: 6400,
                    payment: 'credit',
                    chargeDate: '2026-11-05',
                }),
            ]}
        />
    ),
};

const RestaurantCard: Story = {
    render: () => (
        <Row
            expenses={[
                sampleExpense('11111111-1111-4111-8111-111111111118', day, {
                    text: 'Team lunch',
                    amountCents: 9600,
                    payment: 'voucher',
                    chargeDate: '2026-11-01',
                    personalCents: 2400,
                }),
            ]}
        />
    ),
};

const Installments: Story = {
    render: () => (
        <Row
            isPlan
            expenses={[1, 2, 3].map((part) =>
                sampleExpense(`11111111-1111-4111-8111-11111111112${part}`, day, {
                    categoryId: 'housing',
                    text: 'Sofa',
                    amountCents: 30000,
                    payment: 'credit',
                    chargeDate: `2026-1${part - 1}-05`,
                    plan: { id: PLAN_ID, part, parts: 3 },
                })
            )}
        />
    ),
};

export default meta;
export { Credit, CustomCategory, Direct, Installments, Leaving, NoText, Pending, RestaurantCard, WithTheDay };
