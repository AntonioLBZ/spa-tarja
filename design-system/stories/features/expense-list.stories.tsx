import { ToastProvider } from '@/components/toast/toast';
import { AddFormProvider } from '@/features/expenses/add-form-state';
import { ExpenseList as ExpenseListComponent } from '@/features/expenses/expense-list';

import { AppData, sampleExpense } from './app-data';
import { CUSTOM_CATEGORIES } from './fixtures';

import type { Expense } from '@core/expense';
import type { Meta } from '@storybook/react-vite';

const PLAN_ID = '2a8f6a52-6d4a-4f0e-9d7b-3b8f5f5e3c11';

const EXPENSES: Expense[] = [
    sampleExpense('11111111-1111-4111-8111-111111111111', '2026-10-27', {
        categoryId: 'groceries',
        text: 'Mercadona',
        amountCents: 2340,
    }),
    sampleExpense('11111111-1111-4111-8111-111111111112', '2026-10-27', { text: '', amountCents: 180 }),
    sampleExpense('11111111-1111-4111-8111-111111111113', '2026-10-27', {
        categoryId: 'custom-pets',
        text: 'Vet',
        amountCents: 4200,
    }),
    sampleExpense('11111111-1111-4111-8111-111111111117', '2026-10-27', {
        categoryId: 'leisure',
        text: 'Concert tickets for the whole group of friends',
        amountCents: 6400,
        payment: 'credit',
        chargeDate: '2026-11-05',
    }),
    sampleExpense('11111111-1111-4111-8111-111111111118', '2026-10-27', {
        text: 'Team lunch',
        amountCents: 9600,
        payment: 'voucher',
        chargeDate: '2026-11-01',
        personalCents: 2400,
    }),
    ...[1, 2, 3].map((part) =>
        sampleExpense(`11111111-1111-4111-8111-11111111112${part}`, '2026-10-27', {
            categoryId: 'housing',
            text: 'Sofa',
            amountCents: 30000,
            payment: 'credit',
            chargeDate: `2026-1${part - 1}-05`,
            plan: { id: PLAN_ID, part, parts: 3 },
        })
    ),
    sampleExpense('11111111-1111-4111-8111-111111111131', '2026-10-26', {
        categoryId: 'transport',
        text: 'Bus pass',
        amountCents: 3000,
    }),
    sampleExpense('11111111-1111-4111-8111-111111111132', '2026-10-26', {
        categoryId: 'bills',
        text: 'Electricity',
        amountCents: 5870,
    }),
];

const Story: Meta = {
    title: 'Features/ExpenseList',
    parameters: { layout: 'fullscreen' },
};

export const ExpenseList = () => {
    return (
        <AppData api={{ categories: [...CUSTOM_CATEGORIES], expenses: EXPENSES }}>
            {() => (
                <ToastProvider>
                    <AddFormProvider>
                        <div style={{ margin: '0 auto', maxWidth: '40rem', padding: 'var(--size-4)' }}>
                            <ExpenseListComponent />
                        </div>
                    </AddFormProvider>
                </ToastProvider>
            )}
        </AppData>
    );
};

export default Story;
