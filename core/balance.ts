import { canonicalMember, type SharedMember } from './shared-member';

import type { SharedEntry } from './shared-entry';

interface MemberBalance {
    memberId: string;
    // Positive is what the others owe them, negative is what they owe
    cents: number;
}

// `from` owes `to`
interface Debt {
    from: string;
    to: string;
    cents: number;
}

const liveEntries = (entries: readonly SharedEntry[]): SharedEntry[] => {
    return entries.filter((entry) => entry.deletedAt === null);
};

// Whom the balances are about, in the group's order: every member that isn't merged, those who left included, then any
// id the entries name that the members don't
const ledgerOrder = (entries: readonly SharedEntry[], members: readonly SharedMember[]): string[] => {
    const order = members.filter((member) => member.mergedInto === null).map((member) => member.id);
    const known = new Set(order);
    for (const entry of entries) {
        for (const id of [entry.paidBy, ...entry.shares.map((share) => share.memberId)]) {
            const memberId = canonicalMember(members, id);
            if (known.has(memberId)) continue;
            known.add(memberId);
            order.push(memberId);
        }
    }
    return order;
};

// What each member is owed or owes, from the entries that aren't deleted: whoever paid is credited the whole amount and
// every share is debited, a settlement too. They add up to zero, as the shares add up to the amount.
const memberBalances = (entries: readonly SharedEntry[], members: readonly SharedMember[]): MemberBalance[] => {
    const live = liveEntries(entries);
    const balances = new Map(ledgerOrder(live, members).map((memberId) => [memberId, 0]));
    const add = (id: string, cents: number) => {
        const memberId = canonicalMember(members, id);
        balances.set(memberId, (balances.get(memberId) ?? 0) + cents);
    };

    for (const entry of live) {
        add(entry.paidBy, entry.amountCents);
        for (const share of entry.shares) add(share.memberId, -share.cents);
    }

    return [...balances].map(([memberId, cents]) => ({ memberId, cents }));
};

// Who owes whom, pair by pair: each member with a share owes whoever paid it that share, and what two members owe each
// other is netted into one debt. Pairs come in the group's order, and a pair that is even isn't listed.
const pairwiseDebts = (entries: readonly SharedEntry[], members: readonly SharedMember[]): Debt[] => {
    const live = liveEntries(entries);
    const order = ledgerOrder(live, members);
    const owed = new Map(order.map((memberId) => [memberId, new Map<string, number>()]));
    const owes = (from: string, to: string) => owed.get(from)?.get(to) ?? 0;

    for (const entry of live) {
        const payer = canonicalMember(members, entry.paidBy);
        for (const share of entry.shares) {
            const debtor = canonicalMember(members, share.memberId);
            if (debtor !== payer) owed.get(debtor)?.set(payer, owes(debtor, payer) + share.cents);
        }
    }

    return order.flatMap((first, index) =>
        order.slice(index + 1).flatMap((second): Debt[] => {
            const net = owes(first, second) - owes(second, first);
            if (net > 0) return [{ from: first, to: second, cents: net }];
            if (net < 0) return [{ from: second, to: first, cents: -net }];
            return [];
        })
    );
};

export { memberBalances, pairwiseDebts, type Debt, type MemberBalance };
