import { countedCents, countedOn } from './counting';
import { monthOf } from './month';

import type { Expense } from './expense';

// How many days a YYYY-MM month has
const daysInMonth = (month: string): number => {
    const [year = 0, number = 1] = month.split('-').map(Number);
    return new Date(Date.UTC(year, number, 0)).getUTCDate();
};

// What counted as spent on each day of the month, as `countedOn` and `countedCents` say: index 0 is the first
const spentByDay = (month: string, expenses: readonly Expense[]): number[] => {
    const days = Array.from({ length: daysInMonth(month) }, () => 0);

    for (const expense of expenses) {
        if (expense.deletedAt !== null) continue;
        const day = countedOn(expense);
        if (monthOf(day) !== month) continue;
        const index = Number(day.slice(8, 10)) - 1;
        days[index] = (days[index] ?? 0) + countedCents(expense);
    }

    return days;
};

export { daysInMonth, spentByDay };
