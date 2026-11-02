import { insertPerson, insertPlaceholder, isUniqueViolation, type Person } from '@server/db/members';

import type { GroupClosed, GroupKind, GroupMember, MemberRole, NewGroup, SharedGroup } from '@core/shared-group';

interface GroupRow {
    id: string;
    kind: GroupKind;
    name: string | null;
    currency: string;
    simplify_debts: number;
    deleted_at: number | null;
}

interface MemberRow {
    id: string;
    group_id: string;
    user_id: string | null;
    name: string;
    nickname: string | null;
    role: MemberRole;
    created_at: number;
    claimed_at: number | null;
    left_at: number | null;
    left_seq: number | null;
    archived_at: number | null;
    merged_into: string | null;
    show_in_expenses: number;
}

interface StoredGroup {
    id: string;
    kind: GroupKind;
    name: string | null;
    currency: string;
    simplifyDebts: boolean;
    deletedAt: number | null;
}

// A member with what only the server knows of it: the user behind it never leaves the server
interface StoredMember extends GroupMember {
    userId: string | null;
    // The nickname of that user, which a friend shows live
    nickname: string | null;
    createdAt: number;
    // The cursor of the group when they left, which is as far as they read it
    leftSeq: number | null;
    archivedAt: number | null;
    showInExpenses: boolean;
}

// A group as one of its members finds it: its members in the group's order, and the caller's own
interface GroupState {
    group: StoredGroup;
    members: StoredMember[];
    me: StoredMember;
}

const GROUP_COLUMNS = 'id, kind, name, currency, simplify_debts, deleted_at';

const MEMBERS_WITH_NICKNAMES = `
    SELECT m.id, m.group_id, m.user_id, m.name, profile.nickname, m.role, m.created_at, m.claimed_at, m.left_at, m.left_seq,
        m.archived_at, m.merged_into, m.show_in_expenses
    FROM shared_members m LEFT JOIN profile ON profile.user_id = m.user_id`;

// Every group the user has a member in, closed ones too
const GROUPS = `
    SELECT ${GROUP_COLUMNS} FROM shared_groups
    WHERE id IN (SELECT group_id FROM shared_members WHERE user_id = ?1)
    ORDER BY created_at, id`;

const MEMBERS = `
    ${MEMBERS_WITH_NICKNAMES}
    WHERE m.group_id IN (SELECT group_id FROM shared_members WHERE user_id = ?1)
    ORDER BY m.created_at, m.id`;

// One group, through the user's member in it, so that reading it touches no other group
const IN_GROUP = 'EXISTS (SELECT 1 FROM shared_members WHERE group_id = ?2 AND user_id = ?1)';

const GROUP = `SELECT ${GROUP_COLUMNS} FROM shared_groups WHERE id = ?2 AND ${IN_GROUP}`;

const MEMBERS_OF_GROUP = `
    ${MEMBERS_WITH_NICKNAMES}
    WHERE m.group_id = ?2 AND ${IN_GROUP}
    ORDER BY m.created_at, m.id`;

const toMember = (row: MemberRow): StoredMember => {
    return {
        id: row.id,
        name: row.name,
        role: row.role,
        claimed: row.claimed_at !== null,
        leftAt: row.left_at,
        mergedInto: row.merged_into,
        userId: row.user_id,
        nickname: row.nickname,
        createdAt: row.created_at,
        leftSeq: row.left_seq,
        archivedAt: row.archived_at,
        showInExpenses: row.show_in_expenses === 1,
    };
};

const toStates = (userId: string, groups: GroupRow[], members: MemberRow[]): GroupState[] => {
    return groups.flatMap((row) => {
        const group = {
            id: row.id,
            kind: row.kind,
            name: row.name,
            currency: row.currency,
            simplifyDebts: row.simplify_debts === 1,
            deletedAt: row.deleted_at,
        };
        const ofGroup = members.filter((member) => member.group_id === row.id).map(toMember);
        const me = ofGroup.find((member) => member.userId === userId);
        return me ? [{ group, members: ofGroup, me }] : [];
    });
};

// The group as the caller finds it, or null when they have never been in it
const readGroup = async (db: D1Database, userId: string, groupId: string): Promise<GroupState | null> => {
    const [groups, members] = await Promise.all([
        db.prepare(GROUP).bind(userId, groupId).all<GroupRow>(),
        db.prepare(MEMBERS_OF_GROUP).bind(userId, groupId).all<MemberRow>(),
    ]);
    const [state] = toStates(userId, groups.results, members.results);
    return state ?? null;
};

// A group is read-only for a person who left it, or for everybody once it was deleted. Leaving goes first: that
// person reads it only as it was then.
const closedFor = ({ group, me }: GroupState): GroupClosed | null => {
    if (me.leftAt !== null) return 'left';
    return group.deletedAt === null ? null : 'deleted';
};

// Who may do what only the owner does: the owner, or either side of a friend, which has nothing to hand over
const manages = ({ group, me }: GroupState): boolean => {
    return group.kind === 'direct' || me.role === 'owner';
};

// The people as the caller may see them, picked one by one so that nothing the server keeps for itself can reach an
// answer. A person who left sees only those who were there then, as they were then but for their names.
const visibleMembers = ({ group, members, me }: GroupState): GroupMember[] => {
    const until = me.leftAt ?? Infinity;
    return members
        .filter((member) => member.createdAt <= until)
        .map((member) => {
            const leftThen = member.leftAt !== null && member.leftAt <= until;
            return {
                id: member.id,
                name: group.kind === 'direct' ? (member.nickname ?? member.name) : member.name,
                role: member.role,
                claimed: member.claimed,
                leftAt: leftThen ? member.leftAt : null,
                mergedInto: leftThen ? member.mergedInto : null,
            };
        });
};

const toSharedGroup = (state: GroupState): SharedGroup => {
    const { group, me } = state;
    return {
        id: group.id,
        kind: group.kind,
        name: group.name,
        currency: group.currency,
        simplifyDebts: group.simplifyDebts,
        closed: closedFor(state),
        archived: me.archivedAt !== null,
        me: me.id,
        showInExpenses: me.showInExpenses,
        members: visibleMembers(state),
    };
};

const listGroups = async (db: D1Database, userId: string): Promise<SharedGroup[]> => {
    const [groups, members] = await Promise.all([
        db.prepare(GROUPS).bind(userId).all<GroupRow>(),
        db.prepare(MEMBERS).bind(userId).all<MemberRow>(),
    ]);
    return toStates(userId, groups.results, members.results).map(toSharedGroup);
};

// The group as a write leaves it, for a caller who is in it
const readSharedGroup = async (db: D1Database, userId: string, groupId: string): Promise<SharedGroup> => {
    const state = await readGroup(db, userId, groupId);
    if (!state) throw new Error('The caller is not in the group');
    return toSharedGroup(state);
};

// The groups of that kind the user is in and that are open for them
const countOpenGroups = async (db: D1Database, userId: string, kind: GroupKind): Promise<number> => {
    const row = await db
        .prepare(
            `SELECT COUNT(*) AS n FROM shared_members m JOIN shared_groups g ON g.id = m.group_id
             WHERE m.user_id = ?1 AND m.left_at IS NULL AND g.deleted_at IS NULL AND g.kind = ?2`
        )
        .bind(userId, kind)
        .first<{ n: number }>();
    return row?.n ?? 0;
};

const INSERT_GROUP = `
    INSERT INTO shared_groups (id, kind, name, currency, created_by, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)`;

// The group, its maker as the owner and the dummies, all or nothing. They are a millisecond apart, so the group lists
// them in the order they came.
const createGroup = async (
    db: D1Database,
    maker: Person,
    groupId: string,
    input: NewGroup
): Promise<'created' | 'id-taken'> => {
    const now = Date.now();
    const member = (id: string, position: number) => ({ id, groupId, by: maker.userId, at: now + position });
    try {
        await db.batch([
            db.prepare(INSERT_GROUP).bind(groupId, input.kind, input.name, input.currency, maker.userId, now),
            insertPerson(db, member(input.me.id, 0), maker, 'owner', null),
            ...input.others.map((other, index) => insertPlaceholder(db, member(other.id, index + 1), other.name)),
        ]);
        return 'created';
    } catch (error) {
        if (isUniqueViolation(error)) return 'id-taken';
        throw error;
    }
};

// A name or a switch left null stays as it is
const changeGroup = async (
    db: D1Database,
    groupId: string,
    change: { name: string | null; simplifyDebts: boolean | null }
): Promise<void> => {
    const simplify = change.simplifyDebts === null ? null : Number(change.simplifyDebts);
    await db
        .prepare(
            `UPDATE shared_groups SET name = COALESCE(?2, name), simplify_debts = COALESCE(?3, simplify_debts), updated_at = ?4
             WHERE id = ?1`
        )
        .bind(groupId, change.name, simplify, Date.now())
        .run();
};

// Closes it; nothing in it is deleted
const deleteGroup = async (db: D1Database, groupId: string): Promise<void> => {
    const now = Date.now();
    await db
        .prepare('UPDATE shared_groups SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL')
        .bind(groupId, now)
        .run();
};

export {
    changeGroup,
    closedFor,
    countOpenGroups,
    createGroup,
    deleteGroup,
    listGroups,
    manages,
    readGroup,
    readSharedGroup,
    type GroupState,
};
