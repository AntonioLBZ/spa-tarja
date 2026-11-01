import type { MemberRole } from '@core/shared-group';

// What a person is called when they make or join a group: their nickname, else the name of their account, as it is then
const PERSON_NAME = `(SELECT COALESCE(profile.nickname, "user".name) FROM "user" LEFT JOIN profile ON profile.user_id = "user".id WHERE "user".id = ?3)`;

const INSERT_PERSON = `
    INSERT INTO shared_members (id, group_id, user_id, name, role, created_by, created_at, claimed_at)
    VALUES (?1, ?2, ?3, ${PERSON_NAME}, ?4, ?5, ?6, ?6)`;

const INSERT_PLACEHOLDER = `
    INSERT INTO shared_members (id, group_id, name, role, created_by, created_at)
    VALUES (?1, ?2, ?3, 'member', ?4, ?5)`;

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

export { insertPerson, insertPlaceholder, type NewMember };
