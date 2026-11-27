import { env } from 'cloudflare:workers';

import { send } from '@server/testing/groups';
import { type TestSession } from '@server/testing/session';

// Where each table keeps the user a row belongs to
const OWN_ROWS = [
    ['"user"', 'id'],
    ['"session"', '"userId"'],
    ['"account"', '"userId"'],
    ['expenses', 'user_id'],
    ['categories', 'user_id'],
    ['income', 'user_id'],
    ['budget', 'user_id'],
    ['profile', 'user_id'],
] as const;

const seedOwnData = async (userId: string) => {
    await env.DB.batch([
        env.DB.prepare(
            `INSERT INTO expenses (id, user_id, category_id, text, amount_cents, currency, date, created_at, updated_at, seq)
             VALUES (?1, ?2, 'food', 'Lunch', 1250, 'EUR', '2026-10-25', 1, 1, 1)`
        ).bind(crypto.randomUUID(), userId),
        env.DB.prepare(
            `INSERT INTO categories (id, user_id, name, name_key, created_at) VALUES (?1, ?2, 'Gym', 'gym', 1)`
        ).bind(crypto.randomUUID(), userId),
        env.DB.prepare(
            `INSERT INTO income (user_id, month, amount_cents, currency, updated_at) VALUES (?1, '2026-10', 200000, 'EUR', 1)`
        ).bind(userId),
        env.DB.prepare(
            `INSERT INTO budget (user_id, month, scope, amount_cents, currency, updated_at)
             VALUES (?1, '2026-10', 'total', 150000, 'EUR', 1)`
        ).bind(userId),
        env.DB.prepare(`INSERT INTO profile (user_id, nickname, updated_at) VALUES (?1, 'Nick', 1)`).bind(userId),
        env.DB.prepare(
            `INSERT INTO "account" (id, "accountId", "providerId", "userId", "accessToken", "createdAt", "updatedAt")
             VALUES (?1, ?2, 'google', ?3, 'a-google-token', 1, 1)`
        ).bind(crypto.randomUUID(), crypto.randomUUID(), userId),
    ]);
};

const rowsOf = async (userId: string) => {
    return Promise.all(
        OWN_ROWS.map(async ([table, column]) => {
            const { results } = await env.DB.prepare(`SELECT * FROM ${table} WHERE ${column} = ?1 ORDER BY 1`)
                .bind(userId)
                .all();
            return results;
        })
    );
};

const deleteAccount = (as: TestSession, email = 'ana@example.com') => {
    return send(as, 'DELETE', '/account', { email });
};

const sharedRows = async () => {
    const read = async (table: string) => (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results;
    return Promise.all(['shared_groups', 'shared_members', 'shared_entries', 'friend_invitations'].map(read));
};

export { deleteAccount, OWN_ROWS, rowsOf, seedOwnData, sharedRows };
