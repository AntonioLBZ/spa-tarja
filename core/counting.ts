import type { Expense, Payment } from './expense';

// What the expense says about how it was paid; one that never said was paid at once
function paymentOf(expense: Expense): Payment {
    return expense.payment ?? 'direct';
}

// The day an expense counts on: the day it is charged when that isn't the day it was made
function countedOn(expense: Expense): string {
    return expense.chargeDate ?? expense.date;
}

export { countedOn, paymentOf };
