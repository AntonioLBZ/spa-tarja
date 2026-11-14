import { MAX_PUSH_SUBSCRIPTIONS, type PushLocale, type PushSubscriptionInput } from '@core/push';

interface StoredPushSubscription {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    locale: PushLocale;
}

interface PushRow {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    locale: PushLocale;
}

// Keeps the subscription of a device under the caller, moving it from whoever held that address, and keeps only their
// newest ones, in one batch
const savePushSubscription = async (db: D1Database, userId: string, input: PushSubscriptionInput, now: number) => {
    await db.batch([
        db
            .prepare(
                `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, locale, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
                 ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh,
                    auth = excluded.auth, locale = excluded.locale, updated_at = excluded.updated_at`
            )
            .bind(crypto.randomUUID(), userId, input.endpoint, input.keys.p256dh, input.keys.auth, input.locale, now),
        db
            .prepare(
                `DELETE FROM push_subscriptions WHERE user_id = ?1 AND id NOT IN (
                    SELECT id FROM push_subscriptions WHERE user_id = ?1
                    ORDER BY updated_at DESC, rowid DESC LIMIT ?2)`
            )
            .bind(userId, MAX_PUSH_SUBSCRIPTIONS),
    ]);
};

// Deletes the subscription of that address, only the caller's when a user is named
const deletePushSubscription = async (db: D1Database, endpoint: string, userId?: string) => {
    if (userId === undefined) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(endpoint).run();
        return;
    }
    await db
        .prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1 AND user_id = ?2')
        .bind(endpoint, userId)
        .run();
};

// The subscriptions of these users
const listPushSubscriptions = async (db: D1Database, userIds: readonly string[]): Promise<StoredPushSubscription[]> => {
    if (userIds.length === 0) return [];
    const marks = userIds.map((_, index) => `?${index + 1}`).join(', ');
    const { results } = await db
        .prepare(`SELECT user_id, endpoint, p256dh, auth, locale FROM push_subscriptions WHERE user_id IN (${marks})`)
        .bind(...userIds)
        .all<PushRow>();
    return results.map((row) => ({
        userId: row.user_id,
        endpoint: row.endpoint,
        p256dh: row.p256dh,
        auth: row.auth,
        locale: row.locale,
    }));
};

export { deletePushSubscription, listPushSubscriptions, savePushSubscription, type StoredPushSubscription };
