import { categoryNameKey, type Category } from '@core/category';

// A write either lands, or loses to someone else's id or to another category with the same name
type SaveResult = { category: Category } | { error: 'id-taken' | 'name-taken' };

// The update only runs for the owner, so an id that belongs to someone else changes nothing
const UPSERT = `
    INSERT INTO categories (id, user_id, name, name_key, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5)
    ON CONFLICT (id) DO UPDATE SET name = excluded.name, name_key = excluded.name_key
    WHERE categories.user_id = excluded.user_id
    RETURNING id, name`;

async function saveCategory(db: D1Database, userId: string, id: string, name: string): Promise<SaveResult> {
    try {
        const saved = await db
            .prepare(UPSERT)
            .bind(id, userId, name, categoryNameKey(name), Date.now())
            .first<Category>();
        return saved ? { category: saved } : { error: 'id-taken' };
    } catch (error) {
        // The only unique index left after the id's own conflict is (user, name)
        if (error instanceof Error && error.message.includes('UNIQUE constraint failed'))
            return { error: 'name-taken' };
        throw error;
    }
}

async function listCategories(db: D1Database, userId: string): Promise<Category[]> {
    const { results } = await db
        .prepare('SELECT id, name FROM categories WHERE user_id = ?1 ORDER BY created_at, rowid')
        .bind(userId)
        .all<Category>();
    return results;
}

async function deleteCategory(db: D1Database, userId: string, id: string): Promise<void> {
    await db.prepare('DELETE FROM categories WHERE id = ?1 AND user_id = ?2').bind(id, userId).run();
}

export { deleteCategory, listCategories, saveCategory };
