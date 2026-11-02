import type { MemberRole } from '@core/shared-group';

// What a person is called when they make or join a group: their nickname, else the name of their account, as it is then
const PERSON_NAME = `(SELECT COALESCE(profile.nickname, "user".name) FROM "user" LEFT JOIN profile ON profile.user_id = "user".id WHERE "user".id = ?3)`;

const INSERT_PERSON = `
    INSERT INTO shared_members (id, group_id, user_id, name, role, created_by, created_at, claimed_at)
    VALUES (?1, ?2, ?3, ${PERSON_NAME}, ?4, ?5, ?6, ?6)`;

const INSERT_PLACEHOLDER = `
    INSERT INTO shared_members (id, group_id, name, role, created_by, created_at)
    VALUES (?1, ?2, ?3, 'member', ?4, ?5)`;

// Where the group's cursor stands, which is how far a member who leaves now reads afterwards
const CURSOR = '(SELECT COALESCE(MAX(seq), 0) FROM shared_entries WHERE group_id = shared_members.group_id)';

const MERGE = `UPDATE shared_members SET merged_into = ?2, left_at = ?3, left_seq = ${CURSOR} WHERE id = ?1`;

// The other side of a friend of the user's that is open: the user it is, or null while it is a dummy
const FRIEND = `
    SELECT other.user_id AS userId
    FROM shared_groups g
    JOIN shared_members mine ON mine.group_id = g.id AND mine.user_id = ?2 AND mine.left_at IS NULL
    JOIN shared_members other ON other.group_id = g.id AND other.id <> mine.id
    WHERE g.id = ?1 AND g.kind = 'direct' AND g.deleted_at IS NULL`;

interface NewMember {
    id: string;
    groupId: string;
    // The user who adds them
    by: string;
    at: number;
}

// A member who is that user, named after them
const insertPerson = (db: D1Database, member: NewMember, userId: string, role: MemberRole): D1PreparedStatement => {
    return db.prepare(INSERT_PERSON).bind(member.id, member.groupId, userId, role, member.by, member.at);
};

const insertPlaceholder = (db: D1Database, member: NewMember, name: string): D1PreparedStatement => {
    return db.prepare(INSERT_PLACEHOLDER).bind(member.id, member.groupId, name, member.by, member.at);
};

// A write that clashed on a unique column: an id in use, or a user who is in the group already, which is checked first
const isUniqueViolation = (error: unknown): boolean => {
    return error instanceof Error && error.message.includes('UNIQUE constraint failed');
};

const addPlaceholder = async (db: D1Database, member: NewMember, name: string): Promise<'added' | 'id-taken'> => {
    try {
        await insertPlaceholder(db, member, name).run();
        return 'added';
    } catch (error) {
        if (isUniqueViolation(error)) return 'id-taken';
        throw error;
    }
};

const renameMember = async (db: D1Database, memberId: string, name: string): Promise<void> => {
    await db.prepare('UPDATE shared_members SET name = ?2 WHERE id = ?1').bind(memberId, name).run();
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
    userId: string,
    replaces: string | null
): Promise<'added' | 'id-taken'> => {
    const statements = [insertPerson(db, member, userId, 'member')];
    if (replaces !== null) statements.push(db.prepare(MERGE).bind(replaces, member.id, member.at));
    try {
        await db.batch(statements);
        return 'added';
    } catch (error) {
        if (isUniqueViolation(error)) return 'id-taken';
        throw error;
    }
};

export { addFriend, addPlaceholder, findFriend, insertPerson, insertPlaceholder, isUniqueViolation, renameMember };
