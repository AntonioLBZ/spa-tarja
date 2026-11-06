import type { Expense } from './expense';

// Replaces the item with the same id, or appends it when it's new
const upsertById = <T extends { id: string }>(items: readonly T[], item: T): T[] => {
    return items.some((current) => current.id === item.id)
        ? items.map((current) => (current.id === item.id ? item : current))
        : [...items, item];
};

// What the person sees: the server's copy with their unsynced changes on top
const applyPending = (expenses: readonly Expense[], pending: readonly Expense[]): Expense[] => {
    return pending.reduce<Expense[]>(upsertById, [...expenses]);
};

export { applyPending, upsertById };
