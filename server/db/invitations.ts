import { INVITATION_DAYS } from '@core/invitation';
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
    groupId: string;
    acceptedBy: string | null;
    // Nobody answered or revoked it, it hasn't expired, its friend is open, its dummy still a dummy, and the person on
    // the other side still a user
    open: boolean;
    // The user on the other side of the dummy, who asks to be friends
    inviter: string | null;
}

// A person who takes the place of a dummy, under the name they start with there
interface Taker {
    userId: string;
    name: string;
}

const INVITATION_FROM = `
    FROM friend_invitations i
    JOIN shared_groups g ON g.id = i.group_id
    JOIN shared_members d ON d.id = i.member_id
    LEFT JOIN shared_members inviter ON inviter.group_id = i.group_id AND inviter.id <> i.member_id
        AND inviter.user_id IS NOT NULL AND inviter.left_at IS NULL`;

// ?2 is the time now
const OPEN = `
    i.accepted_at IS NULL AND i.declined_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > ?2
    AND g.kind = 'direct' AND g.deleted_at IS NULL
    AND d.group_id = i.group_id AND d.user_id IS NULL AND d.claimed_at IS NULL AND d.left_at IS NULL
    AND d.merged_into IS NULL AND inviter.user_id IS NOT NULL`;

const READ = `
    SELECT i.id, i.group_id AS groupId, i.accepted_by AS acceptedBy, (${OPEN}) AS open, inviter.user_id AS inviter
    ${INVITATION_FROM} WHERE i.id = ?1`;

// Two users who are friends already: an open friend that both are in
const friendsQuery = (one: string, other: string) => `
    SELECT 1 FROM shared_members a
    JOIN shared_members b ON b.group_id = a.group_id
    JOIN shared_groups f ON f.id = a.group_id
    WHERE f.kind = 'direct' AND f.deleted_at IS NULL AND a.user_id = ${one} AND a.left_at IS NULL
        AND b.user_id = ${other} AND b.left_at IS NULL`;

// Marks it taken by ?3 only while it can be used and the two aren't friends yet, both read in the same statement, so
// that a link serves one person and two links of one person make one friend
const TAKE = `
    UPDATE friend_invitations SET accepted_by = ?3, accepted_at = ?2
    WHERE id = (
        SELECT i.id ${INVITATION_FROM}
        WHERE i.id = ?1 AND ${OPEN} AND inviter.user_id <> ?3 AND NOT EXISTS (${friendsQuery('inviter.user_id', '?3')})
    )`;

// The dummy becomes the person who took the invitation, in the same batch, and only if they did
const CLAIM = `
    UPDATE shared_members SET user_id = ?3, claimed_at = ?2, name = ?4
    WHERE user_id IS NULL
        AND id = (SELECT member_id FROM friend_invitations WHERE id = ?1 AND accepted_by = ?3 AND accepted_at = ?2)`;

const DECLINE = `
    UPDATE friend_invitations SET declined_at = ?2
    WHERE id = (SELECT i.id ${INVITATION_FROM} WHERE i.id = ?1 AND ${OPEN} AND inviter.user_id <> ?3)`;

const readInvitation = async (db: D1Database, id: string): Promise<InvitationState | null> => {
    const row = await db.prepare(READ).bind(id, Date.now()).first<Omit<InvitationState, 'open'> & { open: number }>();
    return row ? { ...row, open: row.open === 1 } : null;
};

const areFriends = async (db: D1Database, one: string, other: string): Promise<boolean> => {
    return (await db.prepare(friendsQuery('?1', '?2')).bind(one, other).first()) !== null;
};

// Whether the person took it: false when it could no longer be used, or the two became friends meanwhile
const acceptInvitation = async (db: D1Database, id: string, taker: Taker): Promise<boolean> => {
    const at = Date.now();
    const [taken] = await db.batch([
        db.prepare(TAKE).bind(id, at, taker.userId),
        db.prepare(CLAIM).bind(id, at, taker.userId, taker.name),
    ]);
    return (taken?.meta.changes ?? 0) > 0;
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

// A link to be friends with nobody behind it, or null when the person has as many open as there can be
const createDirectInvitation = async (
    db: D1Database,
    by: string,
    at: number
): Promise<{ id: string; expiresAt: number } | null> => {
    const id = crypto.randomUUID();
    const expiresAt = at + INVITATION_DAYS * DAY;
    const { meta } = await db.prepare(INSERT_DIRECT).bind(id, at, by, expiresAt).run();
    return meta.changes > 0 ? { id, expiresAt } : null;
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
