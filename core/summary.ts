import { countedOn, paymentOf } from './counting';
import { monthOf } from './month';

import type { Expense } from './expense';

interface MonthSummary {
    month: string;
    // What the person set for the month, or null while they haven't
    incomeCents: number | null;
    // What the restaurant card paid into the month: those expenses are also income (ARCHITECTURE.md §5)
    voucherCents: number;
    spentCents: number;
    // Income, plus the restaurant card, minus what was spent; null until the income is known
    leftCents: number | null;
}

// Everything that counts in the month, as the days in `countedOn` say, whichever category it has
function summarizeMonth(month: string, expenses: readonly Expense[], incomeCents: number | null): MonthSummary {
    let spentCents = 0;
    let voucherCents = 0;

    for (const expense of expenses) {
        if (expense.deletedAt !== null || monthOf(countedOn(expense)) !== month) continue;
        spentCents += expense.amountCents;
        if (paymentOf(expense) === 'voucher') voucherCents += expense.amountCents;
    }

    return {
        month,
        incomeCents,
        voucherCents,
        spentCents,
        leftCents: incomeCents === null ? null : incomeCents + voucherCents - spentCents,
    };
}

export { summarizeMonth };
export type { MonthSummary };
