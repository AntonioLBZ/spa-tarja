import { addMonths } from './date';

import type { Expense } from './expense';

// Three years of months
const MAX_INSTALLMENTS = 36;

// The parts of a total, in cents, as even as they can be: the remainder goes one cent at a time to the first parts
function splitEvenly(totalCents: number, parts: number): number[] {
    const base = Math.floor(totalCents / parts);
    const remainder = totalCents - base * parts;
    return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}

// The day each part counts on: the first on the day of the purchase, the rest a month apart
function installmentDates(date: string, parts: number): string[] {
    return Array.from({ length: parts }, (_, index) => addMonths(date, index));
}

// What is left to assign of the total once the parts are taken out; negative when they go over it
function planBalance(totalCents: number, partCents: readonly number[]): number {
    return totalCents - partCents.reduce((sum, cents) => sum + cents, 0);
}

interface PlanItem {
    kind: 'plan';
    planId: string;
    // In the order of the plan, whichever order they arrived in
    parts: Expense[];
}

interface SingleItem {
    kind: 'single';
    expense: Expense;
}

type ListItem = SingleItem | PlanItem;

// What a list shows: each expense, and the parts of a plan as one item in the place of the first part met
function collapsePlans(expenses: readonly Expense[]): ListItem[] {
    const items: ListItem[] = [];
    const plans = new Map<string, PlanItem>();

    for (const expense of expenses) {
        if (!expense.plan) {
            items.push({ kind: 'single', expense });
            continue;
        }
        let item = plans.get(expense.plan.id);
        if (!item) {
            item = { kind: 'plan', planId: expense.plan.id, parts: [] };
            plans.set(expense.plan.id, item);
            items.push(item);
        }
        item.parts.push(expense);
    }

    for (const item of plans.values()) item.parts.sort((a, b) => (a.plan?.part ?? 0) - (b.plan?.part ?? 0));
    return items;
}

function planTotal(parts: readonly Expense[]): number {
    return parts.reduce((sum, part) => sum + part.amountCents, 0);
}

export { MAX_INSTALLMENTS, collapsePlans, installmentDates, planBalance, planTotal, splitEvenly };
export type { ListItem, PlanItem, SingleItem };
