import { paymentOf } from '@core/counting';
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

// The row a written part is, an existing one or a new one, and when that row counts as made
interface Identity {
    id: string;
    createdAt: number;
}

function byPart(a: Expense, b: Expense): number {
    return (a.plan?.part ?? 0) - (b.plan?.part ?? 0);
}

// The parts to write for what the form holds, each with the identity it is given
function partsOf(draft: Draft, identities: readonly Identity[], planId: string, updatedAt: number): Expense[] {
    const parts = draft.amounts.length;
    const dates = installmentDates(draft.date, parts);

    return draft.amounts.map((amountCents, index) => ({
        id: identities[index]!.id,
        categoryId: draft.categoryId,
        text: draft.text,
        amountCents,
        currency: DEFAULT_CURRENCY,
        date: draft.date,
        payment: draft.payment,
        chargeDate: parts === 1 ? draft.chargeDate : dates[index]!,
        // The server refuses a part of your own on anything but a restaurant card
        personalCents: draft.payment === 'voucher' ? draft.personalCents : null,
        plan: parts === 1 ? null : { id: planId, part: index + 1, parts },
        createdAt: identities[index]!.createdAt,
        updatedAt,
        deletedAt: null,
    }));
}

// The expenses to save for what the form holds: one, or a part for each installment linked as a plan
function createExpenses(draft: Draft): Expense[] {
    const now = Date.now();
    const identities = draft.amounts.map(() => ({ id: crypto.randomUUID(), createdAt: now }));
    return partsOf(draft, identities, crypto.randomUUID(), now);
}

// Whether the form can load them: an expense, or a plan with every one of its parts on this device
function canEdit(parts: readonly Expense[]): boolean {
    const plan = parts[0]?.plan;
    if (!plan) return parts.length === 1;
    return (
        parts.length === plan.parts &&
        parts
            .toSorted(byPart)
            .every(
                (part, index) =>
                    part.plan?.id === plan.id && part.plan.parts === plan.parts && part.plan.part === index + 1
            )
    );
}

// What the form shows for an expense, or for every part of a plan (`canEdit`)
function draftOf(parts: readonly Expense[]): Draft {
    const sorted = parts.toSorted(byPart);
    const first = sorted[0]!;
    const payment = paymentOf(first);

    return {
        categoryId: first.categoryId,
        text: first.text,
        date: first.date,
        payment,
        chargeDate: sorted.length === 1 && payment !== 'direct' ? (first.chargeDate ?? null) : null,
        personalCents: payment === 'voucher' ? (first.personalCents ?? null) : null,
        amounts: sorted.map((part) => part.amountCents),
    };
}

// The writes that turn an expense, or every part of a plan, into what the form holds. Parts keep their id and creation
// time by part number; a part the plan gains is a new row of the same plan, made when its first part was so the plan
// keeps its place in the list, and a part it loses is saved as deleted. An expense that becomes a plan is its first
// part, under a new plan. The writes are newer than every part they replace even when the clock of this device is
// behind, or the server would keep the old version (last write wins).
function reviseExpenses(original: readonly Expense[], draft: Draft, now = Date.now()): Expense[] {
    const sorted = original.toSorted(byPart);
    const first = sorted[0]!;
    const updatedAt = Math.max(now, ...sorted.map((part) => part.updatedAt + 1));
    const planId = first.plan?.id ?? crypto.randomUUID();
    const identities = draft.amounts.map(
        (_, index) => sorted[index] ?? { id: crypto.randomUUID(), createdAt: first.createdAt }
    );
    const removed = sorted.slice(draft.amounts.length).map((part) => ({ ...part, updatedAt, deletedAt: updatedAt }));

    return [...partsOf(draft, identities, planId, updatedAt), ...removed];
}

export { canEdit, createExpenses, draftOf, reviseExpenses };
export type { Draft };
