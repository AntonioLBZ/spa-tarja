import { ledgerOrder } from './balance';
import { canonicalMember, type SharedMember } from './shared-member';

import type { SharedEntry } from './shared-entry';

// The days a table covers, each end a `YYYY-MM-DD` or empty for no bound
interface DayRange {
    from: string;
    to: string;
}

interface GroupTableRow<E extends SharedEntry> {
    entry: E;
    // What the entry does to the balance of each column's member, null for one who neither paid nor has a share
    cells: (number | null)[];
}

// The entries of a group in a range of days, a column per member, the same whoever reads it. Each column adds up:
// the opening balance and the rows make the closing one. Narrowed by more than the days, the rows are only some of
// what moved the balances, so there is no opening balance and the last row is their total.
interface GroupTable<E extends SharedEntry> {
    // Member ids, merged ones read as their target, in the group's order
    columns: string[];
    // What each column held before the first day, only when the range has one and nothing else narrows the rows
    opening: number[] | null;
    rows: GroupTableRow<E>[];
    closing: number[];
    // The last row is the total of the rows, not a balance
    narrowed: boolean;
}

const compare = (a: string | number, b: string | number): number => {
    return a < b ? -1 : a > b ? 1 : 0;
};

// Whoever paid is credited the whole amount and every share is debited, a settlement too, as the balances add it up
const effectOf = (entry: SharedEntry, members: readonly SharedMember[]): Map<string, number> => {
    const effect = new Map<string, number>();
    const add = (id: string, cents: number) => {
        const memberId = canonicalMember(members, id);
        effect.set(memberId, (effect.get(memberId) ?? 0) + cents);
    };
    add(entry.paidBy, entry.amountCents);
    for (const share of entry.shares) add(share.memberId, -share.cents);
    return effect;
};

// `keep` narrows the rows by more than the days
const groupTable = <E extends SharedEntry>(
    entries: readonly E[],
    members: readonly SharedMember[],
    range: DayRange,
    keep?: (entry: E) => boolean
): GroupTable<E> => {
    const narrowed = keep !== undefined;
    // A first day after the last holds no day, so nothing before it is a balance either
    if (range.from !== '' && range.to !== '' && range.from > range.to) {
        return { columns: [], opening: null, rows: [], closing: [], narrowed };
    }
    const live = entries
        .filter((entry) => entry.deletedAt === null && (range.to === '' || entry.date <= range.to))
        .toSorted((a, b) => compare(a.date, b.date) || compare(a.createdAt, b.createdAt) || compare(a.id, b.id));
    const before = live.filter((entry) => !narrowed && range.from !== '' && entry.date < range.from);
    const within = live.filter((entry) => (range.from === '' || entry.date >= range.from) && (keep?.(entry) ?? true));

    const held = new Map<string, number>();
    for (const entry of before) {
        for (const [memberId, cents] of effectOf(entry, members)) held.set(memberId, (held.get(memberId) ?? 0) + cents);
    }

    const effects = within.map((entry) => effectOf(entry, members));
    const shown = new Set(effects.flatMap((effect) => [...effect.keys()]));
    const columns = ledgerOrder(live, members).filter((id) => shown.has(id) || (held.get(id) ?? 0) !== 0);

    const opening = range.from === '' || narrowed ? null : columns.map((id) => held.get(id) ?? 0);
    const rows = within.map((entry, index) => ({
        entry,
        cells: columns.map((id) => effects[index]!.get(id) ?? null),
    }));
    const closing = columns.map(
        (_, column) => (opening?.[column] ?? 0) + rows.reduce((sum, row) => sum + (row.cells[column] ?? 0), 0)
    );

    return { columns, opening, rows, closing, narrowed };
};

export { groupTable, type DayRange, type GroupTable, type GroupTableRow };
