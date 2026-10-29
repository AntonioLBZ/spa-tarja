import { categoryNameKey, type Category, type CategoryInput } from '@core/category';
import { DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from '@core/category-style';

// A write either lands, or loses to someone else's id or to another category with the same name
type SaveResult = { category: Category } | { error: 'id-taken' | 'name-taken' };

// The update only runs for the owner, so an id that belongs to someone else changes nothing. A color or an icon that
// isn't sent (null) is the plain look on a new row and stays as it was on an existing one.
const UPSERT = `
    INSERT INTO categories (id, user_id, name, name_key, created_at, color, icon)
    VALUES (?1, ?2, ?3, ?4, ?5, COALESCE(?6, '${DEFAULT_CATEGORY_COLOR}'), COALESCE(?7, '${DEFAULT_CATEGORY_ICON}'))
    ON CONFLICT (id) DO UPDATE SET
        name = excluded.name,
        name_key = excluded.name_key,
        color = COALESCE(?6, categories.color),
        icon = COALESCE(?7, categories.icon)
    WHERE categories.user_id = excluded.user_id
    RETURNING id, name, color, icon`;

async function saveCategory(db: D1Database, userId: string, id: string, input: CategoryInput): Promise<SaveResult> {
    const { name, color, icon } = input;
    try {
        const saved = await db
            .prepare(UPSERT)
            .bind(id, userId, name, categoryNameKey(name), Date.now(), color ?? null, icon ?? null)
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
        .prepare('SELECT id, name, color, icon FROM categories WHERE user_id = ?1 ORDER BY created_at, rowid')
        .bind(userId)
        .all<Category>();
    return results;
}

// The limits of the category go with it, in the same batch
async function deleteCategory(db: D1Database, userId: string, id: string): Promise<void> {
    await db.batch([
        db.prepare('DELETE FROM budget WHERE user_id = ?1 AND scope = ?2').bind(userId, id),
        db.prepare('DELETE FROM categories WHERE id = ?1 AND user_id = ?2').bind(id, userId),
    ]);
}

export { deleteCategory, listCategories, saveCategory };
