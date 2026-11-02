import { insertPerson, insertPlaceholder, isUniqueViolation } from '@server/db/members';

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
    claimed_at: number | null;
    left_at: number | null;
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
    archivedAt: number | null;
    showInExpenses: boolean;
}

// A group as one of its members finds it: its members in the group's order, and the caller's own
interface GroupState {
    group: StoredGroup;
    members: StoredMember[];
    me: StoredMember;
}

// The groups the user has a member in, closed ones too, and one of them when `?2` names it
const GROUPS = `
    SELECT id, kind, name, currency, simplify_debts, deleted_at
    FROM shared_groups
    WHERE id IN (SELECT group_id FROM shared_members WHERE user_id = ?1) AND (?2 IS NULL OR id = ?2)
    ORDER BY created_at, id`;

const MEMBERS = `
    SELECT m.id, m.group_id, m.user_id, m.name, profile.nickname, m.role, m.claimed_at, m.left_at, m.archived_at,
        m.merged_into, m.show_in_expenses
    FROM shared_members m LEFT JOIN profile ON profile.user_id = m.user_id
    WHERE m.group_id IN (SELECT group_id FROM shared_members WHERE user_id = ?1) AND (?2 IS NULL OR m.group_id = ?2)
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
        archivedAt: row.archived_at,
        showInExpenses: row.show_in_expenses === 1,
    };
};

const loadGroups = async (db: D1Database, userId: string, groupId: string | null): Promise<GroupState[]> => {
    const [groups, members] = await Promise.all([
        db.prepare(GROUPS).bind(userId, groupId).all<GroupRow>(),
        db.prepare(MEMBERS).bind(userId, groupId).all<MemberRow>(),
    ]);

    return groups.results.flatMap((row) => {
        const group = {
            id: row.id,
            kind: row.kind,
            name: row.name,
            currency: row.currency,
            simplifyDebts: row.simplify_debts === 1,
            deletedAt: row.deleted_at,
        };
        const ofGroup = members.results.filter((member) => member.group_id === row.id).map(toMember);
        const me = ofGroup.find((member) => member.userId === userId);
        return me ? [{ group, members: ofGroup, me }] : [];
    });
};

// The group as the caller finds it, or null when they have never been in it
const readGroup = async (db: D1Database, userId: string, groupId: string): Promise<GroupState | null> => {
    const [state] = await loadGroups(db, userId, groupId);
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

// Picked one by one, so that nothing the server keeps for itself can reach an answer
const toSharedGroup = (state: GroupState): SharedGroup => {
    const { group, members, me } = state;
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
        members: members.map((member) => ({
            id: member.id,
            name: group.kind === 'direct' ? (member.nickname ?? member.name) : member.name,
            role: member.role,
            claimed: member.claimed,
            leftAt: member.leftAt,
            mergedInto: member.mergedInto,
        })),
    };
};

const listGroups = async (db: D1Database, userId: string): Promise<SharedGroup[]> => {
    return (await loadGroups(db, userId, null)).map(toSharedGroup);
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
    userId: string,
    groupId: string,
    input: NewGroup
): Promise<'created' | 'id-taken'> => {
    const now = Date.now();
    const member = (id: string, position: number) => ({ id, groupId, by: userId, at: now + position });
    try {
        await db.batch([
            db.prepare(INSERT_GROUP).bind(groupId, input.kind, input.name, input.currency, userId, now),
            insertPerson(db, member(input.me.id, 0), userId, 'owner'),
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
