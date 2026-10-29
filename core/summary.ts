import { countedCents, countedOn, paidBackCents, voucherIncomeOn } from './counting';
import { monthOf } from './month';

import type { Expense } from './expense';

interface MonthSummary {
    month: string;
    // What the person set for the month, or null while they haven't
    incomeCents: number | null;
    // What the restaurant card paid for you of the expenses charged in the month: that is also income (ADR-0007)
    voucherCents: number;
    // What others paid back of the restaurant card expenses made in the month, beyond your part
    paidBackCents: number;
    spentCents: number;
    // Income, plus the restaurant card and what was paid back, minus what was spent; null until the income is known
    leftCents: number | null;
}

// Everything that counts in the month, as `countedOn` and `voucherIncomeOn` say, whichever category it has
function summarizeMonth(month: string, expenses: readonly Expense[], incomeCents: number | null): MonthSummary {
    let spentCents = 0;
    let voucherCents = 0;
    let paidBack = 0;

    for (const expense of expenses) {
        if (expense.deletedAt !== null) continue;
        if (monthOf(countedOn(expense)) === month) {
            spentCents += countedCents(expense);
            paidBack += paidBackCents(expense);
        }
        const voucher = voucherIncomeOn(expense);
        if (voucher && monthOf(voucher.day) === month) voucherCents += voucher.cents;
    }

    return {
        month,
        incomeCents,
        voucherCents,
        paidBackCents: paidBack,
        spentCents,
        leftCents: incomeCents === null ? null : incomeCents + voucherCents + paidBack - spentCents,
    };
}

export { summarizeMonth };
export type { MonthSummary };
