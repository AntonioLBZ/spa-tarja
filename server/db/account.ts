// The tables of a person's own data, each keyed by `user_id`
const OWN_TABLES = ['expenses', 'categories', 'income', 'budget', 'profile'] as const;

const readEmail = async (db: D1Database, userId: string): Promise<string | null> => {
    const row = await db.prepare('SELECT email FROM "user" WHERE id = ?1').bind(userId).first<{ email: string }>();
    return row?.email ?? null;
};

// Everything of the user's own, in one batch, all or nothing. The `user` row goes last: its sessions and accounts go
// with it, and every user column of the shared tables loses it through its foreign key.
const deleteAccount = async (db: D1Database, userId: string): Promise<void> => {
    await db.batch([
        ...OWN_TABLES.map((table) => db.prepare(`DELETE FROM ${table} WHERE user_id = ?1`).bind(userId)),
        db.prepare('DELETE FROM "user" WHERE id = ?1').bind(userId),
    ]);
};

export { deleteAccount, readEmail };
