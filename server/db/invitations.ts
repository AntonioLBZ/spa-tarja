import { ENDED_INVITATION_DAYS, INVITATION_DAYS } from '@core/invitation';
import { DEFAULT_CURRENCY } from '@core/money';
import { MAX_OPEN_INVITATIONS } from '@core/shared-group';

const DAY = 24 * 60 * 60 * 1000;

// The invitation of a friend made last, with how it ended, if it did
interface LatestInvitation {
    id: string;
    expiresAt: number;
    ended: 'accepted' | 'declined' | 'revoked' | null;
}

interface LatestRow {
    id: string;
    expires_at: number;
    accepted_at: number | null;
    declined_at: number | null;
    revoked_at: number | null;
}

// The rowid grows with every invitation made, so the last one made comes first
const LATEST = `
    SELECT id, expires_at, accepted_at, declined_at, revoked_at FROM friend_invitations
    WHERE group_id = ?1 ORDER BY rowid DESC LIMIT 1`;

const REVOKE = `
    UPDATE friend_invitations SET revoked_at = ?2
    WHERE group_id = ?1 AND accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL`;

const INSERT = `
    INSERT INTO friend_invitations (id, group_id, member_id, created_by, created_at, expires_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)`;

// A direct invitation that nobody answered or revoked and that hasn't expired; ?2 is the time now
const PENDING = `
    member_id IS NULL AND accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL AND expires_at > ?2`;

// Only while the person has room for one more, counted in the same statement, so that makes at the same moment can't
// pass the limit
const INSERT_DIRECT = `
    INSERT INTO friend_invitations (id, created_by, created_at, expires_at)
    SELECT ?1, ?3, ?2, ?4
    WHERE (SELECT COUNT(*) FROM friend_invitations WHERE created_by = ?3 AND ${PENDING}) < ${MAX_OPEN_INVITATIONS}`;

// The direct invitations of ?1 that ended before ?2 without being accepted: revoked, declined, or past their end
const PURGE_ENDED_DIRECT = `
    DELETE FROM friend_invitations
    WHERE created_by = ?1 AND member_id IS NULL AND accepted_at IS NULL AND COALESCE(revoked_at, declined_at, expires_at) < ?2`;

// The rowid breaks a tie of two made in the same millisecond, as it grows with every invitation made
const LIST_PENDING = `
    SELECT id, expires_at AS expiresAt FROM friend_invitations
    WHERE created_by = ?1 AND ${PENDING} ORDER BY created_at DESC, rowid DESC`;

const REVOKE_DIRECT = `UPDATE friend_invitations SET revoked_at = ?2 WHERE id = ?3 AND created_by = ?1 AND ${PENDING}`;

const OWN_DIRECT = 'SELECT 1 FROM friend_invitations WHERE id = ?3 AND created_by = ?1 AND member_id IS NULL';

const endOf = (row: LatestRow): LatestInvitation['ended'] => {
    if (row.accepted_at !== null) return 'accepted';
    if (row.declined_at !== null) return 'declined';
    return row.revoked_at === null ? null : 'revoked';
};

// An invitation with what decides whether it can still be taken
interface InvitationState {
    id: string;
    // The friend: the one of the dummy, or the one a direct invitation made once it was accepted
    groupId: string | null;
    // The dummy the person who takes it becomes; none for a direct invitation, which makes a new friend
    memberId: string | null;
    acceptedBy: string | null;
    // Nobody answered or revoked it, it hasn't expired and who asks is still a user; for a dummy, its friend is open too
    // and the dummy still a dummy
    open: boolean;
    // The user who asks to be friends
    inviter: string | null;
}

// A person who takes an invitation, under the name they start with in the friend
interface Taker {
    userId: string;
    name: string;
}

const INVITATION_FROM = `
    FROM friend_invitations i
    LEFT JOIN shared_groups g ON g.id = i.group_id
    LEFT JOIN shared_members d ON d.id = i.member_id
    LEFT JOIN shared_members other ON other.group_id = i.group_id AND other.id <> i.member_id
        AND other.user_id IS NOT NULL AND other.left_at IS NULL`;

// Who made a direct invitation, or the user on the other side of the dummy
const INVITER = '(CASE WHEN i.member_id IS NULL THEN i.created_by ELSE other.user_id END)';

// ?2 is the time now
const OPEN = `
    i.accepted_at IS NULL AND i.declined_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > ?2
    AND ${INVITER} IS NOT NULL
    AND (i.member_id IS NULL OR (
        g.kind = 'direct' AND g.deleted_at IS NULL
        AND d.group_id = i.group_id AND d.user_id IS NULL AND d.claimed_at IS NULL AND d.left_at IS NULL
        AND d.merged_into IS NULL))`;

const READ = `
    SELECT i.id, i.group_id AS groupId, i.member_id AS memberId, i.accepted_by AS acceptedBy, (${OPEN}) AS open,
        ${INVITER} AS inviter
    ${INVITATION_FROM} WHERE i.id = ?1`;

// Two users who are friends already: an open friend that both are in
const friendsQuery = (one: string, other: string) => `
    SELECT 1 FROM shared_members a
    JOIN shared_members b ON b.group_id = a.group_id
    JOIN shared_groups f ON f.id = a.group_id
    WHERE f.kind = 'direct' AND f.deleted_at IS NULL AND a.user_id = ${one} AND a.left_at IS NULL
        AND b.user_id = ${other} AND b.left_at IS NULL`;

// The invitation while ?3 can take it: it can be used, it isn't theirs and the two aren't friends yet, all read in the
// statement that marks it, so that a link serves one person and two links of one person make one friend
const TAKEABLE = `
    SELECT i.id ${INVITATION_FROM}
    WHERE i.id = ?1 AND ${OPEN} AND ${INVITER} <> ?3 AND NOT EXISTS (${friendsQuery(INVITER, '?3')})`;

const TAKE = `
    UPDATE friend_invitations SET accepted_by = ?3, accepted_at = ?2 WHERE member_id IS NOT NULL AND id = (${TAKEABLE})`;

// The dummy becomes the person who took the invitation, in the same batch, and only if they did
const CLAIM = `
    UPDATE shared_members SET user_id = ?3, claimed_at = ?2, name = ?4
    WHERE user_id IS NULL
        AND id = (SELECT member_id FROM friend_invitations WHERE id = ?1 AND accepted_by = ?3 AND accepted_at = ?2)`;

// The friend ?4 a direct invitation makes, written first, as the invitation points at it, and only while the invitation
// can be taken; nothing runs between the statements of a batch, so the mark that follows reads the same
const INSERT_FRIEND = `
    INSERT INTO shared_groups (id, kind, name, currency, created_by, created_at, updated_at)
    SELECT ?4, 'direct', NULL, ?5, i.created_by, ?2, ?2 FROM friend_invitations i
    WHERE i.member_id IS NULL AND i.id IN (${TAKEABLE})`;

const TAKE_DIRECT = `
    UPDATE friend_invitations SET accepted_by = ?3, accepted_at = ?2, group_id = ?4
    WHERE member_id IS NULL AND id = (${TAKEABLE})`;

// The invitation as this very batch marked it: the friend ?4 is new, so no other request holds it
const TAKEN_HERE = `
    FROM friend_invitations i WHERE i.id = ?1 AND i.accepted_by = ?3 AND i.accepted_at = ?2 AND i.group_id = ?4`;

// Who asked owns it and comes first, a millisecond before who accepted
const INSERT_INVITER = `
    INSERT INTO shared_members (id, group_id, user_id, name, role, created_by, created_at, claimed_at)
    SELECT ?5, ?4, i.created_by, ?6, 'owner', i.created_by, ?2, ?2 ${TAKEN_HERE}`;

const INSERT_TAKER = `
    INSERT INTO shared_members (id, group_id, user_id, name, role, created_by, created_at, claimed_at)
    SELECT ?5, ?4, ?3, ?6, 'member', ?3, ?2 + 1, ?2 + 1 ${TAKEN_HERE}`;

const DECLINE = `
    UPDATE friend_invitations SET declined_at = ?2
    WHERE id = (SELECT i.id ${INVITATION_FROM} WHERE i.id = ?1 AND ${OPEN} AND ${INVITER} <> ?3)`;

const readInvitation = async (db: D1Database, id: string): Promise<InvitationState | null> => {
    const row = await db.prepare(READ).bind(id, Date.now()).first<Omit<InvitationState, 'open'> & { open: number }>();
    return row ? { ...row, open: row.open === 1 } : null;
};

const areFriends = async (db: D1Database, one: string, other: string): Promise<boolean> => {
    return (await db.prepare(friendsQuery('?1', '?2')).bind(one, other).first()) !== null;
};

// Whether the person took the invitation of a dummy: false when it could no longer be used, or the two became friends
// meanwhile
const acceptInvitation = async (db: D1Database, id: string, taker: Taker): Promise<boolean> => {
    const at = Date.now();
    const [taken] = await db.batch([
        db.prepare(TAKE).bind(id, at, taker.userId),
        db.prepare(CLAIM).bind(id, at, taker.userId, taker.name),
    ]);
    return (taken?.meta.changes ?? 0) > 0;
};

// The friend a direct invitation made, in the app's currency, with who asked under `inviterName`; or null, with nothing
// written, when it could no longer be used or the two became friends meanwhile
const acceptDirectInvitation = async (
    db: D1Database,
    id: string,
    taker: Taker,
    inviterName: string
): Promise<string | null> => {
    const at = Date.now();
    const friendId = crypto.randomUUID();
    const [, taken] = await db.batch([
        db.prepare(INSERT_FRIEND).bind(id, at, taker.userId, friendId, DEFAULT_CURRENCY),
        db.prepare(TAKE_DIRECT).bind(id, at, taker.userId, friendId),
        db.prepare(INSERT_INVITER).bind(id, at, taker.userId, friendId, crypto.randomUUID(), inviterName),
        db.prepare(INSERT_TAKER).bind(id, at, taker.userId, friendId, crypto.randomUUID(), taker.name),
    ]);
    return (taken?.meta.changes ?? 0) > 0 ? friendId : null;
};

// Whether it was declined: false when it could no longer be used, or it is the caller's own
const declineInvitation = async (db: D1Database, id: string, userId: string): Promise<boolean> => {
    const { meta } = await db.prepare(DECLINE).bind(id, Date.now(), userId).run();
    return meta.changes > 0;
};

const latestInvitation = async (db: D1Database, groupId: string): Promise<LatestInvitation | null> => {
    const row = await db.prepare(LATEST).bind(groupId).first<LatestRow>();
    return row ? { id: row.id, expiresAt: row.expires_at, ended: endOf(row) } : null;
};

// A new invitation for the dummy of a friend, in place of the open one it had, together
const createInvitation = async (
    db: D1Database,
    invitation: { groupId: string; memberId: string; by: string; at: number }
): Promise<{ id: string; expiresAt: number }> => {
    const { groupId, memberId, by, at } = invitation;
    const id = crypto.randomUUID();
    const expiresAt = at + INVITATION_DAYS * DAY;
    await db.batch([
        db.prepare(REVOKE).bind(groupId, at),
        db.prepare(INSERT).bind(id, groupId, memberId, by, at, expiresAt),
    ]);
    return { id, expiresAt };
};

const revokeInvitations = async (db: D1Database, groupId: string): Promise<void> => {
    await db.prepare(REVOKE).bind(groupId, Date.now()).run();
};

// A link to be friends with nobody behind it, or null when the person has as many open as there can be. The person's own
// links that ended long ago go with it, so the table doesn't grow with every link made and revoked.
const createDirectInvitation = async (
    db: D1Database,
    by: string,
    at: number
): Promise<{ id: string; expiresAt: number } | null> => {
    const id = crypto.randomUUID();
    const expiresAt = at + INVITATION_DAYS * DAY;
    const [, inserted] = await db.batch([
        db.prepare(PURGE_ENDED_DIRECT).bind(by, at - ENDED_INVITATION_DAYS * DAY),
        db.prepare(INSERT_DIRECT).bind(id, at, by, expiresAt),
    ]);
    return (inserted?.meta.changes ?? 0) > 0 ? { id, expiresAt } : null;
};

// The direct invitations of the person that can still be used, newest first
const listPendingInvitations = async (
    db: D1Database,
    userId: string
): Promise<Array<{ id: string; expiresAt: number }>> => {
    const { results } = await db
        .prepare(LIST_PENDING)
        .bind(userId, Date.now())
        .all<{ id: string; expiresAt: number }>();
    return results;
};

// Whether it is a direct invitation of the person's, which is then revoked if it was still open
const revokeDirectInvitation = async (db: D1Database, userId: string, id: string): Promise<boolean> => {
    const now = Date.now();
    const [, own] = await db.batch([
        db.prepare(REVOKE_DIRECT).bind(userId, now, id),
        db.prepare(OWN_DIRECT).bind(userId, now, id),
    ]);
    return (own?.results.length ?? 0) > 0;
};

export {
    acceptDirectInvitation,
    acceptInvitation,
    areFriends,
    createDirectInvitation,
    createInvitation,
    declineInvitation,
    latestInvitation,
    listPendingInvitations,
    readInvitation,
    revokeDirectInvitation,
    revokeInvitations,
    type InvitationState,
};
