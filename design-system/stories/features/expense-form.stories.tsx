import { ToastProvider } from '@/components/toast/toast';
import { ExpenseForm } from '@/features/expenses/expense-form';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Expense } from '@core/expense';
import type { Meta, StoryObj } from '@storybook/react-vite';

const SAVED = sampleExpense('55555555-5555-4555-8555-555555555551', '2026-10-27', {
    categoryId: 'groceries',
    text: 'Supermarket',
    amountCents: 4380,
});

function Form(props: { editing?: Expense[]; copying?: Expense[]; title: string }) {
    const { editing, copying, title } = props;

    return (
        <ToastProvider>
            <AppData api={{ categories: [...CUSTOM_CATEGORIES], expenses: [SAVED] }}>
                {() => <ExpenseForm title={title} editing={editing} copying={copying} />}
            </AppData>
        </ToastProvider>
    );
}

const meta = {
    title: 'Features/ExpenseForm',
} satisfies Meta;

type Story = StoryObj<typeof meta>;

const Adding: Story = { render: () => <Form title="Add an expense" /> };

const Editing: Story = { render: () => <Form title="Edit the expense" editing={[SAVED]} /> };

const Copying: Story = { render: () => <Form title="Copy the expense" copying={[SAVED]} /> };

export default meta;
export { Adding, Copying, Editing };
