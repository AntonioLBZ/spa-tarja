import { monthOf } from './month';

import type { Expense, Payment } from './expense';

// What the expense says about how it was paid; one that never said was paid at once
function paymentOf(expense: Expense): Payment {
    return expense.payment ?? 'direct';
}

// Your part of a restaurant card expense: what it says, or the whole amount when it says nothing
function personalPart(expense: Expense): number {
    return expense.personalCents ?? expense.amountCents;
}

// The day an expense counts on: the day it is charged when that isn't the day it was made, except for a restaurant
// card, which counts on the day it was made (ADR-0007)
function countedOn(expense: Expense): string {
    if (paymentOf(expense) === 'voucher') return expense.date;
    return expense.chargeDate ?? expense.date;
}

// What an expense counts as spent: your part of a restaurant card expense, the whole amount of any other
function countedCents(expense: Expense): number {
    return paymentOf(expense) === 'voucher' ? personalPart(expense) : expense.amountCents;
}

// What a restaurant card expense brings in as income: your part, on the first day of the month it is charged; none for
// any other payment
function voucherIncomeOn(expense: Expense): { day: string; cents: number } | null {
    if (paymentOf(expense) !== 'voucher') return null;
    return { day: `${monthOf(expense.chargeDate ?? expense.date)}-01`, cents: personalPart(expense) };
}

// What others pay back of a restaurant card expense, beyond your part, counted on the day it was made (`countedOn`)
function paidBackCents(expense: Expense): number {
    return paymentOf(expense) === 'voucher' ? expense.amountCents - personalPart(expense) : 0;
}

export { countedCents, countedOn, paidBackCents, paymentOf, voucherIncomeOn };
