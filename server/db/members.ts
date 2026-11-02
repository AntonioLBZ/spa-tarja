import { MAX_GROUP_MEMBERS, type MemberRole, type MySwitches } from '@core/shared-group';

// Whether the group has room for one more, counted in the same statement that adds them so that adds at the same
// moment can't pass the limit: the members who haven't left, but for the dummy the new one replaces
const room = (replaces: string) => `
    (SELECT COUNT(*) FROM shared_members WHERE group_id = ?2 AND left_at IS NULL AND id IS NOT ${replaces})
    < ${MAX_GROUP_MEMBERS}`;

const INSERT_PERSON = `
    INSERT INTO shared_members (id, group_id, user_id, name, role, created_by, created_at, claimed_at)
    SELECT ?1, ?2, ?3, ?7, ?4, ?5, ?6, ?6 WHERE ${room('?8')}`;

const INSERT_PLACEHOLDER = `
    INSERT INTO shared_members (id, group_id, name, role, created_by, created_at)
    SELECT ?1, ?2, ?3, 'member', ?4, ?5 WHERE ${room('NULL')}`;

// Where the group's cursor stands, which is how far a member who leaves now reads afterwards
const CURSOR = '(SELECT COALESCE(MAX(seq), 0) FROM shared_entries WHERE group_id = shared_members.group_id)';

// Only a placeholder still in the group, so that a merge is never redone or chained, and only into a member who is
// there, so that it does nothing when that member couldn't be added
const MERGE = `
    UPDATE shared_members SET merged_into = ?2, left_at = ?3, left_seq = ${CURSOR}
    WHERE id = ?1 AND merged_into IS NULL AND left_at IS NULL
        AND EXISTS (SELECT 1 FROM shared_members AS target WHERE target.id = ?2)`;

// The other side of a friend of the user's that is open: the user it is, or null while it is a dummy
const FRIEND = `
    SELECT other.user_id AS userId
    FROM shared_groups g
    JOIN shared_members mine ON mine.group_id = g.id AND mine.user_id = ?2 AND mine.left_at IS NULL
    JOIN shared_members other ON other.group_id = g.id AND other.id <> mine.id
    WHERE g.id = ?1 AND g.kind = 'direct' AND g.deleted_at IS NULL`;

// A user who goes into a group, under the name they start with there
interface Person {
    userId: string;
    name: string;
}

interface NewMember {
    id: string;
    groupId: string;
    // The user who adds them
    by: string;
    at: number;
}

// Nothing is added when the group is full
const insertPerson = (
    db: D1Database,
    member: NewMember,
    person: Person,
    role: MemberRole,
    replaces: string | null
): D1PreparedStatement => {
    return db
        .prepare(INSERT_PERSON)
        .bind(member.id, member.groupId, person.userId, role, member.by, member.at, person.name, replaces);
};

const insertPlaceholder = (db: D1Database, member: NewMember, name: string): D1PreparedStatement => {
    return db.prepare(INSERT_PLACEHOLDER).bind(member.id, member.groupId, name, member.by, member.at);
};

// A write that clashed on a unique column: an id in use, or a user who is in the group already, which is checked first
const isUniqueViolation = (error: unknown): boolean => {
    return error instanceof Error && error.message.includes('UNIQUE constraint failed');
};

const addPlaceholder = async (
    db: D1Database,
    member: NewMember,
    name: string
): Promise<'added' | 'full' | 'id-taken'> => {
    try {
        const { meta } = await insertPlaceholder(db, member, name).run();
        return meta.changes === 0 ? 'full' : 'added';
    } catch (error) {
        if (isUniqueViolation(error)) return 'id-taken';
        throw error;
    }
};

const renameMember = async (db: D1Database, memberId: string, name: string): Promise<void> => {
    await db.prepare('UPDATE shared_members SET name = ?2 WHERE id = ?1').bind(memberId, name).run();
};

// The row stays, so the entries go on naming the member
const leaveGroup = async (db: D1Database, memberId: string): Promise<void> => {
    await db
        .prepare(`UPDATE shared_members SET left_at = ?2, left_seq = ${CURSOR} WHERE id = ?1 AND left_at IS NULL`)
        .bind(memberId, Date.now())
        .run();
};

// From then on the placeholder's id means `into`, and it has left
const mergeMember = async (db: D1Database, memberId: string, into: string): Promise<void> => {
    await db.prepare(MERGE).bind(memberId, into, Date.now()).run();
};

// The owner becomes a member, and that member the owner, together
const handOver = async (db: D1Database, groupId: string, to: string): Promise<void> => {
    await db.batch([
        db.prepare(`UPDATE shared_members SET role = 'member' WHERE group_id = ?1 AND role = 'owner'`).bind(groupId),
        db.prepare(`UPDATE shared_members SET role = 'owner' WHERE id = ?1`).bind(to),
    ]);
};

// A switch that isn't sent stays as it is; archiving again keeps the day it was archived
const saveMySwitches = async (db: D1Database, memberId: string, switches: MySwitches): Promise<void> => {
    const flag = (value: boolean | undefined) => (value === undefined ? null : Number(value));
    await db
        .prepare(
            `UPDATE shared_members SET
                show_in_expenses = COALESCE(?2, show_in_expenses),
                archived_at = CASE ?3 WHEN 1 THEN COALESCE(archived_at, ?4) WHEN 0 THEN NULL ELSE archived_at END
             WHERE id = ?1`
        )
        .bind(memberId, flag(switches.showInExpenses), flag(switches.archived), Date.now())
        .run();
};

// Nothing when the group isn't an open friend of the user's
const findFriend = async (
    db: D1Database,
    userId: string,
    friendId: string
): Promise<{ userId: string | null } | null> => {
    return db.prepare(FRIEND).bind(friendId, userId).first<{ userId: string | null }>();
};

// The friend and, in place of a dummy, the dummy merged into them, all or nothing
const addFriend = async (
    db: D1Database,
    member: NewMember,
    friend: Person,
    replaces: string | null
): Promise<'added' | 'full' | 'id-taken'> => {
    const statements = [insertPerson(db, member, friend, 'member', replaces)];
    if (replaces !== null) statements.push(db.prepare(MERGE).bind(replaces, member.id, member.at));
    try {
        const [inserted] = await db.batch(statements);
        return inserted?.meta.changes === 0 ? 'full' : 'added';
    } catch (error) {
        if (isUniqueViolation(error)) return 'id-taken';
        throw error;
    }
};

export {
    addFriend,
    addPlaceholder,
    findFriend,
    handOver,
    insertPerson,
    insertPlaceholder,
    isUniqueViolation,
    leaveGroup,
    mergeMember,
    renameMember,
    saveMySwitches,
    type Person,
};
