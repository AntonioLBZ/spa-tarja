import { yourPart } from '@core/groups/shared-expense';
import { canonicalMember, type SharedMember } from '@core/groups/shared-member';

import { isNarrowing, parseSearch, searchMatches } from './search';

import type { SharedEntry } from '@core/groups/shared-entry';

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
    // The amounts a search finds an entry by; those of the person's row of the ledger when not given
    amountsOf?: (entry: SharedEntry) => number[];
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

// Whether an entry passes the filters; a merged placeholder is read as the member it became
const ledgerMatcher = (filters: LedgerFilters, ctx: LedgerContext): ((entry: SharedEntry) => boolean) => {
    const { categoryId, from, to, paidBy, kind } = filters;
    const search = parseSearch(filters.query, ctx.locale);
    const narrowing = isNarrowing(search);
    const amountsOf = ctx.amountsOf ?? ((entry: SharedEntry) => ledgerAmountsOf(entry, ctx));

    return (entry) => {
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
            () => amountsOf(entry)
        );
    };
};

// The entries that pass the filters, in the order given
const filterLedger = <T extends SharedEntry>(
    entries: readonly T[],
    filters: LedgerFilters,
    ctx: LedgerContext
): T[] => {
    return entries.filter(ledgerMatcher(filters, ctx));
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
    ledgerMatcher,
    type EntryKind,
    type LedgerContext,
    type LedgerFilters,
};
