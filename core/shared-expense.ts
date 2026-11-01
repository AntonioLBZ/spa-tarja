import { canonicalMember, type SharedMember } from './shared-member';

import type { Expense } from './expense';
import type { SharedEntry } from './shared-entry';

type SharedExpenseEntry = Extract<SharedEntry, { kind: 'expense' }>;

// The entries of one group as the device holds them, and the person's own in it
interface SharedLedger {
    groupId: string;
    // The person's member in the group
    me: string;
    // The person's switch Show in my expenses for the group
    showInExpenses: boolean;
    members: readonly SharedMember[];
    entries: readonly SharedEntry[];
}

// What a row of a shared expense says beyond an expense of one person
interface SharedSource {
    groupId: string;
    // Whoever paid, a merged placeholder read as its target
    paidBy: string;
    // The whole expense, of which the row counts your part
    totalCents: number;
}

// Your part of a shared expense in the shape of an expense of yours, under the id of the entry
interface SharedExpenseRow extends Expense {
    shared: SharedSource;
}

// Your share of an entry, together with those of the placeholders merged into you
const yourPart = (entry: SharedEntry, me: string, members: readonly SharedMember[]): number => {
    return entry.shares
        .filter((share) => canonicalMember(members, share.memberId) === me)
        .reduce((sum, share) => sum + share.cents, 0);
};

// The payer's row follows their card, as an expense of theirs alone would: a credit card counts their part on the day it
// is charged, and a restaurant card holds the total with their part as `personalCents`, what the others owe being what
// is paid back. Everybody else paid now.
const rowOf = (entry: SharedExpenseEntry, ledger: SharedLedger, part: number): SharedExpenseRow => {
    const paidBy = canonicalMember(ledger.members, entry.paidBy);
    const payment = paidBy === ledger.me ? entry.payment : 'direct';
    const row = {
        id: entry.id,
        categoryId: entry.categoryId,
        text: entry.text,
        currency: entry.currency,
        date: entry.date,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        deletedAt: null,
        shared: { groupId: ledger.groupId, paidBy, totalCents: entry.amountCents },
    };

    if (payment === 'voucher') {
        return { ...row, amountCents: entry.amountCents, personalCents: part, payment, chargeDate: entry.chargeDate };
    }
    if (payment === 'credit') return { ...row, amountCents: part, payment, chargeDate: entry.chargeDate };
    return { ...row, amountCents: part, payment, chargeDate: null };
};

// The rows of your part of the expenses of the groups whose switch Show in my expenses is on, open or closed. An entry
// that was deleted, a settlement and an expense you have no part in give none (ADR-0012).
const sharedExpenseRows = (ledgers: readonly SharedLedger[]): SharedExpenseRow[] => {
    return ledgers
        .filter((ledger) => ledger.showInExpenses)
        .flatMap((ledger) =>
            ledger.entries.flatMap((entry) => {
                if (entry.kind !== 'expense' || entry.deletedAt !== null) return [];
                const part = yourPart(entry, ledger.me, ledger.members);
                return part > 0 ? [rowOf(entry, ledger, part)] : [];
            })
        );
};

export { sharedExpenseRows, yourPart, type SharedExpenseRow, type SharedLedger, type SharedSource };
