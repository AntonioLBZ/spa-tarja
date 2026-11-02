import type { Payment } from '@core/expense';
import type { Share, SharedEntry, SplitMode } from '@core/shared-entry';

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

const COLUMNS =
    'id, kind, text, category_id, amount_cents, currency, date, paid_by, split, shares, payment, charge_date, created_at, updated_at, deleted_at';

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

// The entries of a group that aren't deleted, which are all its balances are made of
const listLiveEntries = async (db: D1Database, groupId: string): Promise<SharedEntry[]> => {
    const { results } = await db
        .prepare(`SELECT ${COLUMNS} FROM shared_entries WHERE group_id = ?1 AND deleted_at IS NULL`)
        .bind(groupId)
        .all<EntryRow>();
    return results.map(toEntry);
};

export { listLiveEntries };
