import type { Payment } from '@core/expense';
import type { LedgerEntry, Share, SharedEntry, SharedEntryInput, SplitMode } from '@core/shared-entry';

type EntryRow = {
    id: string;
    text: string;
    amount_cents: number;
    currency: string;
    date: string;
    paid_by: string;
    split: SplitMode;
    // JSON, as the server stored it after checking it
    shares: string;
    payment: Payment;
    charge_date: string | null;
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
} & ({ kind: 'expense'; category_id: string } | { kind: 'settlement'; category_id: null });

// An entry with where it is in its group, and its writers as their members there
type LedgerRow = EntryRow & {
    group_id: string;
    seq: number;
    created_by_member: string | null;
    updated_by_member: string | null;
};

const COLUMNS =
    'id, kind, text, category_id, amount_cents, currency, date, paid_by, split, shares, payment, charge_date, created_at, updated_at, deleted_at';

// The users who made an entry and wrote it last, read as their members in its group: a user id never leaves the database
const writer = (column: 'created_by' | 'updated_by') =>
    `(SELECT id FROM shared_members WHERE group_id = shared_entries.group_id AND user_id = shared_entries.${column})`;

const LEDGER_COLUMNS = `${COLUMNS}, group_id, seq, ${writer('created_by')} AS created_by_member, ${writer('updated_by')} AS updated_by_member`;

const toEntry = (row: EntryRow): SharedEntry => {
    const entry = {
        id: row.id,
        text: row.text,
        amountCents: row.amount_cents,
        currency: row.currency,
        date: row.date,
        paidBy: row.paid_by,
        shares: JSON.parse(row.shares) as Share[],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
    };
    if (row.kind === 'settlement') {
        return { ...entry, kind: 'settlement', categoryId: null, split: 'exact', payment: 'direct', chargeDate: null };
    }
    return {
        ...entry,
        kind: 'expense',
        categoryId: row.category_id,
        split: row.split,
        payment: row.payment,
        chargeDate: row.charge_date,
    };
};

const toLedgerEntry = (row: LedgerRow): LedgerEntry => {
    return { ...toEntry(row), createdBy: row.created_by_member, updatedBy: row.updated_by_member };
};

// The entries of a group that aren't deleted, which are all its balances are made of
const listLiveEntries = async (db: D1Database, groupId: string): Promise<SharedEntry[]> => {
    const { results } = await db
        .prepare(`SELECT ${COLUMNS} FROM shared_entries WHERE group_id = ?1 AND deleted_at IS NULL`)
        .bind(groupId)
        .all<EntryRow>();
    return results.map(toEntry);
};

// An entry as stored, in whichever group it is
interface StoredEntry {
    groupId: string;
    seq: number;
    entry: LedgerEntry;
}

const readEntry = async (db: D1Database, id: string): Promise<StoredEntry | null> => {
    const row = await db
        .prepare(`SELECT ${LEDGER_COLUMNS} FROM shared_entries WHERE id = ?1`)
        .bind(id)
        .first<LedgerRow>();
    return row ? { groupId: row.group_id, seq: row.seq, entry: toLedgerEntry(row) } : null;
};

// Written only while the user is in the group and it is open, checked in the statement itself so that a leave or a delete
// can't come between. `seq` is the group's cursor: every applied write takes the next one of its group. The update only
// runs for an entry of the same group and when the write is strictly newer, so a retry and a stale write both leave it
// alone (ADR-0013).
const UPSERT = `
    INSERT INTO shared_entries (id, group_id, kind, text, category_id, amount_cents, currency, date, paid_by, split, shares,
        payment, charge_date, created_by, updated_by, created_at, updated_at, deleted_at, seq)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14, ?15, ?16, ?17,
        (SELECT COALESCE(MAX(seq), 0) + 1 FROM shared_entries WHERE group_id = ?2)
    WHERE EXISTS (
        SELECT 1 FROM shared_members m JOIN shared_groups g ON g.id = m.group_id
        WHERE m.group_id = ?2 AND m.user_id = ?14 AND m.left_at IS NULL AND g.deleted_at IS NULL)
    ON CONFLICT (id) DO UPDATE SET
        kind = excluded.kind,
        text = excluded.text,
        category_id = excluded.category_id,
        amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        date = excluded.date,
        paid_by = excluded.paid_by,
        split = excluded.split,
        shares = excluded.shares,
        payment = excluded.payment,
        charge_date = excluded.charge_date,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        seq = excluded.seq
    WHERE shared_entries.group_id = excluded.group_id AND shared_entries.updated_at < excluded.updated_at
    RETURNING ${LEDGER_COLUMNS}`;

// Who writes which entry of which group
interface EntryWriter {
    groupId: string;
    id: string;
    userId: string;
}

// The entry as the write left it, or null when nothing was written
const upsertEntry = async (
    db: D1Database,
    { groupId, id, userId }: EntryWriter,
    input: SharedEntryInput
): Promise<LedgerEntry | null> => {
    const row = await db
        .prepare(UPSERT)
        .bind(
            id,
            groupId,
            input.kind,
            input.text,
            input.categoryId,
            input.amountCents,
            input.currency,
            input.date,
            input.paidBy,
            input.split,
            JSON.stringify(input.shares),
            input.payment,
            input.chargeDate,
            userId,
            input.createdAt,
            input.updatedAt,
            input.deletedAt
        )
        .first<LedgerRow>();
    return row ? toLedgerEntry(row) : null;
};

interface EntryChanges {
    entries: LedgerEntry[];
    cursor: number;
    hasMore: boolean;
}

// What the group wrote after `cursor`, oldest first, tombstones included, up to `until` for a member who left
const listEntryChanges = async (
    db: D1Database,
    groupId: string,
    page: { after: number; limit: number; until: number | null }
): Promise<EntryChanges> => {
    const { results } = await db
        .prepare(
            `SELECT ${LEDGER_COLUMNS} FROM shared_entries
             WHERE group_id = ?1 AND seq > ?2 AND (?4 IS NULL OR seq <= ?4)
             ORDER BY seq LIMIT ?3`
        )
        .bind(groupId, page.after, page.limit + 1, page.until)
        .all<LedgerRow>();

    const hasMore = results.length > page.limit;
    const rows = hasMore ? results.slice(0, page.limit) : results;
    return { entries: rows.map(toLedgerEntry), cursor: rows.at(-1)?.seq ?? page.after, hasMore };
};

export { listEntryChanges, listLiveEntries, readEntry, upsertEntry, type EntryChanges, type StoredEntry };
