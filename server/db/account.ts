// The tables of a person's own data, each keyed by `user_id`
const OWN_TABLES = ['expenses', 'categories', 'income', 'budget', 'profile'] as const;

// A member of the same group as `m` who is somebody else using the app and hasn't left
const OTHER_USER = `
    SELECT o.id FROM shared_members o
    WHERE o.group_id = m.group_id AND o.user_id IS NOT NULL AND o.user_id <> ?1 AND o.left_at IS NULL`;

// The groups they are in where nobody else has an account (a member who left keeps theirs, one who deleted theirs has
// none): a group of placeholders, a group or a friend the others deleted their accounts from. Nobody could read them
// once the account is gone.
const ERASABLE = `
    SELECT m.group_id FROM shared_members m
    WHERE m.user_id = ?1 AND NOT EXISTS (
        SELECT 1 FROM shared_members o WHERE o.group_id = m.group_id AND o.user_id IS NOT NULL AND o.user_id <> ?1)`;

// In foreign key order
const ERASE_GROUP_ROWS = [
    `DELETE FROM friend_invitations WHERE group_id IN (${ERASABLE})`,
    `UPDATE shared_members SET merged_into = NULL WHERE group_id IN (${ERASABLE})`,
    `DELETE FROM shared_entries WHERE group_id IN (${ERASABLE})`,
    `DELETE FROM shared_members WHERE group_id IN (${ERASABLE})`,
] as const;

// The groups emptied just before: no group can exist with no members through the API
const ERASE_EMPTY_GROUPS = `
    DELETE FROM shared_groups
    WHERE NOT EXISTS (SELECT 1 FROM shared_members WHERE group_id = shared_groups.id)
        AND NOT EXISTS (SELECT 1 FROM shared_entries WHERE group_id = shared_groups.id)
        AND NOT EXISTS (SELECT 1 FROM friend_invitations WHERE group_id = shared_groups.id)`;

const REVOKE_INVITATIONS = `
    UPDATE friend_invitations SET revoked_at = ?2
    WHERE created_by = ?1 AND accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL`;

// The open groups they are in where nobody else would be left who uses the app, since everybody else with an account
// has left, and the friends they are in, which an account that is gone ends for the other person: the friends nobody
// else could read are erased before, so each one that is left has somebody on the other side
const CLOSE_GROUPS = `
    UPDATE shared_groups SET deleted_at = ?2, updated_at = ?2
    WHERE deleted_at IS NULL AND id IN (
        SELECT m.group_id FROM shared_members m JOIN shared_groups g ON g.id = m.group_id
        WHERE m.user_id = ?1 AND m.left_at IS NULL AND (g.kind = 'direct' OR NOT EXISTS (${OTHER_USER})))`;

const STEP_DOWN = `UPDATE shared_members SET role = 'member' WHERE user_id = ?1 AND role = 'owner'`;

// In each of their groups left without an owner, the member who uses the app and joined first takes it
const HAND_OVER = `
    UPDATE shared_members SET role = 'owner'
    WHERE id IN (
        SELECT (${OTHER_USER} ORDER BY o.claimed_at, o.id LIMIT 1) FROM shared_members m
        WHERE m.user_id = ?1
            AND NOT EXISTS (SELECT 1 FROM shared_members w WHERE w.group_id = m.group_id AND w.role = 'owner'))`;

// The screens call a member with no name "Deleted user"
const FORGET_NAMES = `UPDATE shared_members SET name = '' WHERE user_id = ?1`;

const readEmail = async (db: D1Database, userId: string): Promise<string | null> => {
    const row = await db.prepare('SELECT email FROM "user" WHERE id = ?1').bind(userId).first<{ email: string }>();
    return row?.email ?? null;
};

// Everything of the user's own goes, in one batch, all or nothing. A group nobody else has an account in is erased, with
// its names and entries. In the other groups, their members stay, nameless, and so do the entries. The owner steps down
// before anybody takes over, as a group has one owner, and their members are found by `user_id` until the `user` row
// goes last: its sessions and accounts go with it, and every user column of the shared tables loses it through its
// foreign key.
const deleteAccount = async (db: D1Database, userId: string): Promise<void> => {
    const now = Date.now();
    await db.batch([
        ...ERASE_GROUP_ROWS.map((sql) => db.prepare(sql).bind(userId)),
        db.prepare(ERASE_EMPTY_GROUPS),
        db.prepare(REVOKE_INVITATIONS).bind(userId, now),
        db.prepare(CLOSE_GROUPS).bind(userId, now),
        db.prepare(STEP_DOWN).bind(userId),
        db.prepare(HAND_OVER).bind(userId),
        db.prepare(FORGET_NAMES).bind(userId),
        ...OWN_TABLES.map((table) => db.prepare(`DELETE FROM ${table} WHERE user_id = ?1`).bind(userId)),
        db.prepare('DELETE FROM "user" WHERE id = ?1').bind(userId),
    ]);
};

export { deleteAccount, readEmail };
