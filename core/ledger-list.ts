import { isNarrowing, parseSearch, searchMatches } from './search';
import { yourPart } from './shared-expense';
import { canonicalMember, type SharedMember } from './shared-member';

import type { SharedEntry } from './shared-entry';

// Which entries a ledger keeps: all of them, the expenses alone or the settlements alone
const ENTRY_KINDS = ['all', 'expense', 'settlement'] as const;

type EntryKind = (typeof ENTRY_KINDS)[number];

interface LedgerFilters {
    // What was typed in the search
    query: string;
    // The category to keep, which only an expense has; empty for all of them
    categoryId: string;
    // The days the entry was made between, both included; empty leaves that end open
    from: string;
    to: string;
    // The member who paid; empty for anyone
    paidBy: string;
    // A member who paid it or has a share of it; empty for anyone
    with: string;
    kind: EntryKind;
}

const NO_LEDGER_FILTERS: LedgerFilters = {
    query: '',
    categoryId: '',
    from: '',
    to: '',
    paidBy: '',
    with: '',
    kind: 'all',
};

interface LedgerContext {
    members: readonly SharedMember[];
    // The person's own member
    me: string;
    // What a search reads in an entry, normalised: what its row shows of it
    textOf: (entry: SharedEntry) => string;
    // The language amounts are typed in, English when not given
    locale?: string;
}

// The amounts a row of the ledger shows: what the entry does to the person's balance, unless it does nothing, and the
// whole that was paid
const ledgerAmountsOf = (entry: SharedEntry, ctx: LedgerContext): number[] => {
    const paidByMe = canonicalMember(ctx.members, entry.paidBy) === ctx.me;
    const effect = (paidByMe ? entry.amountCents : 0) - yourPart(entry, ctx.me, ctx.members);
    return effect === 0 ? [entry.amountCents] : [Math.abs(effect), entry.amountCents];
};

const isIn = (entry: SharedEntry, memberId: string, members: readonly SharedMember[]): boolean => {
    return (
        canonicalMember(members, entry.paidBy) === memberId ||
        entry.shares.some((share) => canonicalMember(members, share.memberId) === memberId)
    );
};

// The entries that pass the filters, in the order given; a merged placeholder is read as the member it became
const filterLedger = <T extends SharedEntry>(
    entries: readonly T[],
    filters: LedgerFilters,
    ctx: LedgerContext
): T[] => {
    const { categoryId, from, to, paidBy, kind } = filters;
    const search = parseSearch(filters.query, ctx.locale);
    const narrowing = isNarrowing(search);

    return entries.filter((entry) => {
        if (kind !== 'all' && entry.kind !== kind) return false;
        if (categoryId !== '' && entry.categoryId !== categoryId) return false;
        if (from !== '' && entry.date < from) return false;
        if (to !== '' && entry.date > to) return false;
        if (paidBy !== '' && canonicalMember(ctx.members, entry.paidBy) !== paidBy) return false;
        if (filters.with !== '' && !isIn(entry, filters.with, ctx.members)) return false;
        if (!narrowing) return true;
        return searchMatches(
            search,
            () => ctx.textOf(entry),
            () => ledgerAmountsOf(entry, ctx)
        );
    });
};

// How many of the search and the filters are in use, the dates one together
const ledgerFilterCount = (filters: LedgerFilters): number => {
    return [
        isNarrowing(parseSearch(filters.query)),
        filters.categoryId !== '',
        filters.from !== '' || filters.to !== '',
        filters.paidBy !== '',
        filters.with !== '',
        filters.kind !== 'all',
    ].filter(Boolean).length;
};

export {
    ENTRY_KINDS,
    NO_LEDGER_FILTERS,
    filterLedger,
    ledgerFilterCount,
    type EntryKind,
    type LedgerContext,
    type LedgerFilters,
};
