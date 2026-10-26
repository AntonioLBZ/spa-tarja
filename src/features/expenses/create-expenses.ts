import { installmentDates } from '@core/installments';
import { DEFAULT_CURRENCY } from '@core/money';

import type { Expense, Payment } from '@core/expense';

interface Draft {
    categoryId: string;
    text: string;
    date: string;
    payment: Payment;
    // Of a deferred expense; an expense in installments takes the day of each part instead
    chargeDate: string | null;
    // Your part of a restaurant card expense, or null for the whole amount
    personalCents: number | null;
    // One amount in cents for an expense paid at once, or one for each installment
    amounts: readonly number[];
}

// The expenses to save for what the form holds: one, or a part for each installment linked as a plan
function createExpenses(draft: Draft): Expense[] {
    const now = Date.now();
    const parts = draft.amounts.length;
    const planId = crypto.randomUUID();
    const dates = installmentDates(draft.date, parts);

    return draft.amounts.map((amountCents, index) => ({
        id: crypto.randomUUID(),
        categoryId: draft.categoryId,
        text: draft.text,
        amountCents,
        currency: DEFAULT_CURRENCY,
        date: draft.date,
        payment: draft.payment,
        chargeDate: parts === 1 ? draft.chargeDate : dates[index],
        personalCents: draft.personalCents,
        plan: parts === 1 ? null : { id: planId, part: index + 1, parts },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
    }));
}

export { createExpenses };
export type { Draft };
