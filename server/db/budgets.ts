import type { Budget, BudgetLimitsInput } from '@core/budget';

// One row per user, month and scope: a write replaces the amount, so repeating it changes nothing
const UPSERT = `
    INSERT INTO budget (user_id, month, scope, amount_cents, currency, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    ON CONFLICT (user_id, month, scope) DO UPDATE SET
        amount_cents = excluded.amount_cents,
        currency = excluded.currency,
        updated_at = excluded.updated_at
    RETURNING month, scope, amount_cents AS amountCents, currency`;

// All the limits of a month land together or not at all: D1 runs a batch as one transaction
const saveBudgets = async (
    db: D1Database,
    userId: string,
    month: string,
    input: BudgetLimitsInput
): Promise<Budget[]> => {
    const now = Date.now();
    const results = await db.batch<Budget>(
        input.limits.map((limit) =>
            db.prepare(UPSERT).bind(userId, month, limit.scope, limit.amountCents, input.currency, now)
        )
    );
    return results.flatMap((result) => result.results);
};

const listBudgets = async (db: D1Database, userId: string): Promise<Budget[]> => {
    const { results } = await db
        .prepare(
            'SELECT month, scope, amount_cents AS amountCents, currency FROM budget WHERE user_id = ?1 ORDER BY month, scope'
        )
        .bind(userId)
        .all<Budget>();
    return results;
};

export { listBudgets, saveBudgets };
