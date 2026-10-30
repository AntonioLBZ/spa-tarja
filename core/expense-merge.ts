import type { Expense } from './expense';

// Replaces the expense with the same id, or appends it when it's new
const upsertById = (expenses: readonly Expense[], expense: Expense): Expense[] => {
    return expenses.some((item) => item.id === expense.id)
        ? expenses.map((item) => (item.id === expense.id ? expense : item))
        : [...expenses, expense];
};

// What the person sees: the server's copy with their unsynced changes on top
const applyPending = (expenses: readonly Expense[], pending: readonly Expense[]): Expense[] => {
    return pending.reduce<Expense[]>(upsertById, [...expenses]);
};

export { applyPending, upsertById };
