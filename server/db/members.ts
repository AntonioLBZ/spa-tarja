import {
    MAX_GROUP_MEMBER_ROWS,
    MAX_GROUP_MEMBERS,
    MAX_PINNED_GROUPS,
    type MemberRole,
    type MySwitches,
} from '@core/shared-group';

// Whether the group has room for one more, counted in the same statement that adds them so that adds at the same
// moment can't pass the limits: the members who haven't left, but for the dummy the new one replaces, and every row
// the group ever had
const room = (replaces: string) => `
    (SELECT COUNT(*) FROM shared_members WHERE group_id = ?2 AND left_at IS NULL AND id IS NOT ${replaces})
        < ${MAX_GROUP_MEMBERS}
    AND (SELECT COUNT(*) FROM shared_members WHERE group_id = ?2) < ${MAX_GROUP_MEMBER_ROWS}`;

const INSERT_PERSON = `
    INSERT INTO shared_members (id, group_id, user_id, name, role, created_by, created_at, claimed_at)
    SELECT ?1, ?2, ?3, ?7, ?4, ?5, ?6, ?6 WHERE ${room('?8')}`;

const INSERT_PLACEHOLDER = `
    INSERT INTO shared_members (id, group_id, name, role, created_by, created_at)
    SELECT ?1, ?2, ?3, 'member', ?4, ?5 WHERE ${room('NULL')}`;

// A user who left, in a group that is open and has room for one more besides the dummy ?1 they replace, counted in the
// statement that brings them back like an add is. ?2 is their member, `member` its alias.
const canReturn = (member: string) => `
    ${member}.id = ?2 AND ${member}.user_id IS NOT NULL AND ${member}.left_at IS NOT NULL AND ${member}.merged_into IS NULL
    AND EXISTS (SELECT 1 FROM shared_groups g WHERE g.id = ${member}.group_id AND g.deleted_at IS NULL)
    AND (SELECT COUNT(*) FROM shared_members live WHERE live.group_id = ${member}.group_id AND live.left_at IS NULL
        AND live.id IS NOT ?1) < ${MAX_GROUP_MEMBERS}`;

// The row they left comes back as it was, keeping its name, role, switch and place; only what leaving and archiving
// set is cleared, and the pin of a group that closed, so it comes back unpinned
const REOPEN = `
    UPDATE shared_members AS m SET left_at = NULL, left_seq = NULL, archived_at = NULL, pinned_at = NULL WHERE ${canReturn('m')}`;

// Where the group's cursor stands, which is how far a member who leaves now reads afterwards
const CURSOR = '(SELECT COALESCE(MAX(seq), 0) FROM shared_entries WHERE group_id = shared_members.group_id)';

// Only a placeholder still in the group, so that a merge is never redone or chained, and only into a member who is
// there, so that it does nothing when that member couldn't be added
const MERGE = `
    UPDATE shared_members SET merged_into = ?2, left_at = ?3, left_seq = ${CURSOR}
    WHERE id = ?1 AND merged_into IS NULL AND left_at IS NULL
        AND EXISTS (SELECT 1 FROM shared_members AS target WHERE target.id = ?2)`;

// The dummy ?1 merged into the member ?2 who comes back, and only while they can. It runs first and reads the same
// conditions as the statement that brings them back, which the dummy leaving doesn't change, so the two go together.
const MERGE_BEFORE_RETURN = `
    UPDATE shared_members SET merged_into = ?2, left_at = ?3, left_seq = ${CURSOR}
    WHERE id = ?1 AND merged_into IS NULL AND left_at IS NULL
        AND EXISTS (SELECT 1 FROM shared_members AS m WHERE ${canReturn('m')})`;

// The other side of a friend of the user's that is open: the user it is
const FRIEND = `
    SELECT other.user_id AS userId
    FROM shared_groups g
    JOIN shared_members mine ON mine.group_id = g.id AND mine.user_id = ?2 AND mine.left_at IS NULL
    JOIN shared_members other ON other.group_id = g.id AND other.id <> mine.id AND other.user_id IS NOT NULL
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

type AddResult = 'added' | 'full' | 'too-many-ever' | 'id-taken';

// Which limit stopped an add: the rows the group ever had, which no removal frees, or the people in it
const refusal = async (db: D1Database, groupId: string): Promise<'full' | 'too-many-ever'> => {
    const row = await db
        .prepare('SELECT COUNT(*) AS n FROM shared_members WHERE group_id = ?1')
        .bind(groupId)
        .first<{ n: number }>();
    return (row?.n ?? 0) >= MAX_GROUP_MEMBER_ROWS ? 'too-many-ever' : 'full';
};

const addPlaceholder = async (db: D1Database, member: NewMember, name: string): Promise<AddResult> => {
    try {
        const { meta } = await insertPlaceholder(db, member, name).run();
        return meta.changes === 0 ? await refusal(db, member.groupId) : 'added';
    } catch (error) {
        if (isUniqueViolation(error)) return 'id-taken';
        throw error;
    }
};

const renameMember = async (db: D1Database, memberId: string, name: string): Promise<void> => {
    await db.prepare('UPDATE shared_members SET name = ?2 WHERE id = ?1').bind(memberId, name).run();
};

// The row stays, so the entries go on naming the member. Whether they left now: not the owner, who may have been made
// one since the request read the group, and not one who left already.
const leaveGroup = async (db: D1Database, memberId: string): Promise<boolean> => {
    const { meta } = await db
        .prepare(
            `UPDATE shared_members SET left_at = ?2, left_seq = ${CURSOR}
             WHERE id = ?1 AND left_at IS NULL AND role <> 'owner'`
        )
        .bind(memberId, Date.now())
        .run();
    return meta.changes > 0;
};

// From then on the placeholder's id means `into`, and it has left
const mergeMember = async (db: D1Database, memberId: string, into: string): Promise<void> => {
    await db.prepare(MERGE).bind(memberId, into, Date.now()).run();
};

// The owner becomes a member, and that member the owner, together, and only while that member is still there. Whether
// it was done.
const handOver = async (db: D1Database, groupId: string, to: string): Promise<boolean> => {
    const [, promoted] = await db.batch([
        db
            .prepare(
                `UPDATE shared_members SET role = 'member'
                 WHERE group_id = ?1 AND role = 'owner'
                    AND EXISTS (SELECT 1 FROM shared_members WHERE id = ?2 AND group_id = ?1 AND left_at IS NULL)`
            )
            .bind(groupId, to),
        db
            .prepare(`UPDATE shared_members SET role = 'owner' WHERE id = ?2 AND group_id = ?1 AND left_at IS NULL`)
            .bind(groupId, to),
    ]);
    return (promoted?.meta.changes ?? 0) > 0;
};

// A switch that isn't sent stays as it is; archiving again keeps the day it was archived. Pinning is `pinMember`.
const saveMySwitches = async (db: D1Database, memberId: string, switches: MySwitches): Promise<void> => {
    const flag = (value: boolean | undefined) => (value === undefined ? null : Number(value));
    await db
        .prepare(
            `UPDATE shared_members SET
                show_in_expenses = COALESCE(?2, show_in_expenses),
                archived_at = CASE ?3 WHEN 1 THEN COALESCE(archived_at, ?4) WHEN 0 THEN NULL ELSE archived_at END,
                pinned_at = CASE ?5 WHEN 0 THEN NULL ELSE pinned_at END
             WHERE id = ?1`
        )
        .bind(memberId, flag(switches.showInExpenses), flag(switches.archived), Date.now(), flag(switches.pinned))
        .run();
};

// Pins a member that isn't pinned while its user has fewer pinned groups that are open for them than the limit,
// counted in the statement that pins it so that pins at the same moment can't pass it; false when it didn't
const pinMember = async (db: D1Database, userId: string, memberId: string): Promise<boolean> => {
    const result = await db
        .prepare(
            `UPDATE shared_members SET pinned_at = ?3
             WHERE id = ?1 AND pinned_at IS NULL
                AND (SELECT COUNT(*) FROM shared_members m JOIN shared_groups g ON g.id = m.group_id
                     WHERE m.user_id = ?2 AND m.pinned_at IS NOT NULL AND m.left_at IS NULL AND g.deleted_at IS NULL)
                    < ${MAX_PINNED_GROUPS}`
        )
        .bind(memberId, userId, Date.now())
        .run();
    return result.meta.changes > 0;
};

// Nothing when the group isn't an open friend of the user's
const findFriend = async (db: D1Database, userId: string, friendId: string): Promise<{ userId: string } | null> => {
    return db.prepare(FRIEND).bind(friendId, userId).first<{ userId: string }>();
};

// The friend and, in place of a dummy, the dummy merged into them, all or nothing
const addFriend = async (
    db: D1Database,
    member: NewMember,
    friend: Person,
    replaces: string | null
): Promise<AddResult> => {
    const statements = [insertPerson(db, member, friend, 'member', replaces)];
    if (replaces !== null) statements.push(db.prepare(MERGE).bind(replaces, member.id, member.at));
    try {
        const [inserted] = await db.batch(statements);
        return inserted?.meta.changes === 0 ? await refusal(db, member.groupId) : 'added';
    } catch (error) {
        if (isUniqueViolation(error)) return 'id-taken';
        throw error;
    }
};

// A member who left comes back by reopening their row, with the dummy they replace merged into it, all or nothing.
// Whether they came back: not when they hadn't left, when the group was deleted or when it has no room, including when
// another request brought them back first.
const reopenMember = async (
    db: D1Database,
    memberId: string,
    replaces: string | null,
    at: number
): Promise<boolean> => {
    const statements = [db.prepare(REOPEN).bind(replaces, memberId)];
    if (replaces !== null) statements.unshift(db.prepare(MERGE_BEFORE_RETURN).bind(replaces, memberId, at));
    const results = await db.batch(statements);
    return (results.at(-1)?.meta.changes ?? 0) > 0;
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
    pinMember,
    renameMember,
    reopenMember,
    saveMySwitches,
    type Person,
};
