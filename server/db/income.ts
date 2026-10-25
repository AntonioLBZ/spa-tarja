import type { Income, IncomeInput } from '@core/income';

// One row per user and month: a write replaces the amount, so repeating it changes nothing
const UPSERT = `
    INSERT INTO income (user_id, month, amount_cents, currency, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT (user_id, month) DO UPDATE SET
        amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        updated_at = excluded.updated_at
    RETURNING month, amount_cents AS amountCents, currency`;

async function saveIncome(db: D1Database, userId: string, month: string, input: IncomeInput): Promise<Income> {
    const saved = await db
        .prepare(UPSERT)
        .bind(userId, month, input.amountCents, input.currency, Date.now())
        .first<Income>();
    if (!saved) throw new Error('The income was not saved');
    return saved;
}

async function listIncome(db: D1Database, userId: string): Promise<Income[]> {
    const { results } = await db
        .prepare('SELECT month, amount_cents AS amountCents, currency FROM income WHERE user_id = ?1 ORDER BY month')
        .bind(userId)
        .all<Income>();
    return results;
}

async function deleteIncome(db: D1Database, userId: string, month: string): Promise<void> {
    await db.prepare('DELETE FROM income WHERE user_id = ?1 AND month = ?2').bind(userId, month).run();
}

export { deleteIncome, listIncome, saveIncome };
