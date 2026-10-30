import type { Expense, ExpenseInput, Payment } from '@core/expense';

interface ExpenseRow {
    id: string;
    category_id: string;
    text: string;
    amount_cents: number;
    currency: string;
    date: string;
    payment: Payment;
    charge_date: string | null;
    personal_cents: number | null;
    plan_id: string | null;
    plan_part: number | null;
    plan_parts: number | null;
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
    seq: number;
}

const COLUMNS =
    'id, category_id, text, amount_cents, currency, date, payment, charge_date, personal_cents, plan_id, plan_part, plan_parts, created_at, updated_at, deleted_at, seq';

const toExpense = (row: ExpenseRow): Expense => {
    return {
        id: row.id,
        categoryId: row.category_id,
        text: row.text,
        amountCents: row.amount_cents,
        currency: row.currency,
        date: row.date,
        payment: row.payment,
        chargeDate: row.charge_date,
        personalCents: row.personal_cents,
        plan: row.plan_id ? { id: row.plan_id, part: row.plan_part ?? 1, parts: row.plan_parts ?? 1 } : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
    };
};

// `seq` is the per-user sync cursor: every applied write takes the next one. The update only runs for the
// owner and when the write is strictly newer, so a retry and a stale write both leave the row alone (ADR-0005).
const UPSERT = `
    INSERT INTO expenses (id, user_id, category_id, text, amount_cents, currency, date, payment, charge_date, personal_cents, plan_id, plan_part, plan_parts, created_at, updated_at, deleted_at, seq)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?11, ?12, ?16, ?13, ?14, ?15, ?8, ?9, ?10, (SELECT COALESCE(MAX(seq), 0) + 1 FROM expenses WHERE user_id = ?2))
    ON CONFLICT (id) DO UPDATE SET
        category_id = excluded.category_id,
        text = excluded.text,
        amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        date = excluded.date,
        payment = excluded.payment,
        charge_date = excluded.charge_date,
        personal_cents = excluded.personal_cents,
        plan_id = excluded.plan_id,
        plan_part = excluded.plan_part,
        plan_parts = excluded.plan_parts,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        seq = excluded.seq
    WHERE expenses.user_id = excluded.user_id AND expenses.updated_at < excluded.updated_at
    RETURNING ${COLUMNS}`;

// The stored expense after the write, or null when the id belongs to someone else
const upsertExpense = async (
    db: D1Database,
    userId: string,
    id: string,
    input: ExpenseInput
): Promise<Expense | null> => {
    const written = await db
        .prepare(UPSERT)
        .bind(
            id,
            userId,
            input.categoryId,
            input.text,
            input.amountCents,
            input.currency,
            input.date,
            input.createdAt,
            input.updatedAt,
            input.deletedAt,
            input.payment ?? 'direct',
            input.chargeDate ?? null,
            input.plan?.id ?? null,
            input.plan?.part ?? null,
            input.plan?.parts ?? null,
            input.personalCents ?? null
        )
        .first<ExpenseRow>();
    if (written) return toExpense(written);

    const stored = await db
        .prepare(`SELECT ${COLUMNS}, user_id FROM expenses WHERE id = ?1`)
        .bind(id)
        .first<ExpenseRow & { user_id: string }>();
    return stored?.user_id === userId ? toExpense(stored) : null;
};

interface Changes {
    expenses: Expense[];
    cursor: number;
    hasMore: boolean;
}

// Everything written after `cursor`, oldest first, tombstones included
const listChanges = async (db: D1Database, userId: string, cursor: number, limit: number): Promise<Changes> => {
    const { results } = await db
        .prepare(`SELECT ${COLUMNS} FROM expenses WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3`)
        .bind(userId, cursor, limit + 1)
        .all<ExpenseRow>();

    const hasMore = results.length > limit;
    const page = hasMore ? results.slice(0, limit) : results;
    return { expenses: page.map(toExpense), cursor: page.at(-1)?.seq ?? cursor, hasMore };
};

export { listChanges, upsertExpense, type Changes };
