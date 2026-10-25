import type { Expense } from './expense';

interface DayGroup {
    date: string;
    expenses: Expense[];
}

// Live expenses by day, newest day first and, within a day, the latest logged first
function groupByDay(expenses: readonly Expense[]): DayGroup[] {
    const sorted = expenses
        .filter((expense) => expense.deletedAt === null)
        .toSorted((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

    const groups: DayGroup[] = [];
    for (const expense of sorted) {
        const last = groups.at(-1);
        if (last?.date === expense.date) last.expenses.push(expense);
        else groups.push({ date: expense.date, expenses: [expense] });
    }
    return groups;
}

export { groupByDay };
export type { DayGroup };
