import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createFakeAuth } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { AppProviders } from '@/providers';

import { ExpenseRow, type ExpenseRowProps } from './expense-row';

import type { Expense } from '@core/expense';
import type { SharedExpenseRow } from '@core/shared-expense';

const lunch: Expense = {
    id: crypto.randomUUID(),
    categoryId: 'food',
    text: 'Lunch',
    amountCents: 1250,
    currency: 'EUR',
    date: '2026-10-24',
    createdAt: 1_000,
    updatedAt: 1_000,
    deletedAt: null,
};

const dinner: SharedExpenseRow = {
    ...lunch,
    id: crypto.randomUUID(),
    text: 'Dinner',
    shared: { groupId: crypto.randomUUID(), paidBy: crypto.randomUUID(), totalCents: 4000 },
};

const open = async (expense: Expense, props: Partial<ExpenseRowProps> = {}) => {
    const handlers = { onEdit: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() };
    render(
        <AppProviders auth={createFakeAuth().auth} storage={createMemoryStorage()}>
            <ul>
                <ExpenseRow
                    expenses={[expense]}
                    isPlan={false}
                    pending={false}
                    leaving={false}
                    {...handlers}
                    {...props}
                />
            </ul>
        </AppProviders>
    );
    await screen.findByText(expense.text);
    return handlers;
};

describe('an expense row', () => {
    it('has a panel to open for an expense of your own', async () => {
        await open(lunch);

        expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('has no actions for a part of a shared expense whose source is missing, so no personal handler can run', async () => {
        const handlers = await open(dinner);

        expect(screen.queryAllByRole('button')).toEqual([]);
        expect(handlers.onEdit).not.toHaveBeenCalled();
        expect(handlers.onDuplicate).not.toHaveBeenCalled();
        expect(handlers.onDelete).not.toHaveBeenCalled();
    });
});
