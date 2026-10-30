import { ToastProvider } from '@/components/toast/toast';
import { ExpenseForm as ExpenseFormComponent, type ExpenseFormProps } from '@/features/expenses/expense-form';
import { fn } from 'storybook/test';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Meta } from '@storybook/react-vite';

const SAVED = sampleExpense('55555555-5555-4555-8555-555555555551', '2026-10-27', {
    categoryId: 'groceries',
    text: 'Supermarket',
    amountCents: 4380,
});

interface ExpenseFormStoryProps extends Omit<ExpenseFormProps, 'editing' | 'copying'> {
    // Adds a new expense, or starts from a saved one to change it or to copy it
    mode: 'adding' | 'editing' | 'copying';
}

const Story: Meta<ExpenseFormStoryProps> = {
    title: 'Features/ExpenseForm',
    args: { title: 'Add an expense', mode: 'adding', onDone: fn(), onAdded: fn() },
    argTypes: {
        title: { control: 'text' },
        mode: { control: 'inline-radio', options: ['adding', 'editing', 'copying'] },
        onDone: { control: false },
        onAdded: { control: false },
    },
};

export const ExpenseForm = (args: ExpenseFormStoryProps) => {
    const { mode, ...props } = args;

    return (
        <ToastProvider>
            <AppData key={mode} api={{ categories: [...CUSTOM_CATEGORIES], expenses: [SAVED] }}>
                {() => (
                    <ExpenseFormComponent
                        {...props}
                        editing={mode === 'editing' ? [SAVED] : undefined}
                        copying={mode === 'copying' ? [SAVED] : undefined}
                    />
                )}
            </AppData>
        </ToastProvider>
    );
};

export default Story;
