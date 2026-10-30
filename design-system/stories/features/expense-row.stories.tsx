import { CardList } from '@/components/card/card';
import { ExpenseRow as ExpenseRowComponent, type ExpenseRowProps } from '@/features/expenses/expense-row';
import { fn } from 'storybook/test';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Expense } from '@core/expense';
import type { Meta } from '@storybook/react-vite';

import '@/features/expenses/expense-list.css';

const DAY = '2026-10-27';
const PLAN_ID = '2a8f6a52-6d4a-4f0e-9d7b-3b8f5f5e3c11';

const EXPENSES = {
    direct: [sampleExpense('11111111-1111-4111-8111-111111111111', DAY)],
    noText: [sampleExpense('11111111-1111-4111-8111-111111111112', DAY, { text: '' })],
    customCategory: [
        sampleExpense('11111111-1111-4111-8111-111111111113', DAY, {
            categoryId: 'custom-pets',
            text: 'Vet',
            amountCents: 4200,
        }),
    ],
    credit: [
        sampleExpense('11111111-1111-4111-8111-111111111117', DAY, {
            categoryId: 'leisure',
            text: 'Concert tickets',
            amountCents: 6400,
            payment: 'credit',
            chargeDate: '2026-11-05',
        }),
    ],
    restaurantCard: [
        sampleExpense('11111111-1111-4111-8111-111111111118', DAY, {
            text: 'Team lunch',
            amountCents: 9600,
            payment: 'voucher',
            chargeDate: '2026-11-01',
            personalCents: 2400,
        }),
    ],
    installments: [1, 2, 3].map((part) =>
        sampleExpense(`11111111-1111-4111-8111-11111111112${part}`, DAY, {
            categoryId: 'housing',
            text: 'Sofa',
            amountCents: 30000,
            payment: 'credit',
            chargeDate: `2026-1${part - 1}-05`,
            plan: { id: PLAN_ID, part, parts: 3 },
        })
    ),
} satisfies Record<string, Expense[]>;

interface ExpenseRowStoryProps extends Omit<ExpenseRowProps, 'expenses' | 'isPlan' | 'toggleRef'> {
    // What the row holds: an expense of one kind, or the parts of a plan
    kind: keyof typeof EXPENSES;
}

const Story: Meta<ExpenseRowStoryProps> = {
    title: 'Features/ExpenseRow',
    args: {
        kind: 'direct',
        pending: false,
        leaving: false,
        showDate: false,
        onEdit: fn(),
        onDuplicate: fn(),
        onDelete: fn(),
    },
    argTypes: {
        kind: { control: 'select', options: Object.keys(EXPENSES) },
        onEdit: { control: false },
        onDuplicate: { control: false },
        onDelete: { control: false },
    },
};

export const ExpenseRow = (args: ExpenseRowStoryProps) => {
    const { kind, ...props } = args;

    return (
        <AppData api={{ categories: [...CUSTOM_CATEGORIES] }}>
            {() => (
                <section className="expense-list__group">
                    <CardList flush>
                        <ExpenseRowComponent {...props} expenses={EXPENSES[kind]} isPlan={kind === 'installments'} />
                    </CardList>
                </section>
            )}
        </AppData>
    );
};

export default Story;
