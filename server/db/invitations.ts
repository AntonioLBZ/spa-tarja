import { ENDED_INVITATION_DAYS, INVITATION_DAYS } from '@core/invitation';
import { DEFAULT_CURRENCY } from '@core/money';
import { MAX_OPEN_INVITATIONS } from '@core/shared-group';

const DAY = 24 * 60 * 60 * 1000;

// An invitation that nobody answered or revoked and that hasn't expired; ?2 is the time now
const PENDING = `
    accepted_at IS NULL AND declined_at IS NULL AND revoked_at IS NULL AND expires_at > ?2`;

// Only while the person has room for one more, counted in the same statement, so that makes at the same moment can't
// pass the limit
const INSERT_INVITATION = `
    INSERT INTO friend_invitations (id, created_by, created_at, expires_at)
    SELECT ?1, ?3, ?2, ?4
    WHERE (SELECT COUNT(*) FROM friend_invitations WHERE created_by = ?3 AND ${PENDING}) < ${MAX_OPEN_INVITATIONS}`;

// The invitations of ?1 that ended before ?2 without being accepted: revoked, declined, or past their end
const PURGE_ENDED = `
    DELETE FROM friend_invitations
    WHERE created_by = ?1 AND accepted_at IS NULL AND COALESCE(revoked_at, declined_at, expires_at) < ?2`;

// The rowid breaks a tie of two made in the same millisecond, as it grows with every invitation made
const LIST_PENDING = `
    SELECT id, expires_at AS expiresAt FROM friend_invitations
    WHERE created_by = ?1 AND ${PENDING} ORDER BY created_at DESC, rowid DESC`;

const REVOKE = `UPDATE friend_invitations SET revoked_at = ?2 WHERE id = ?3 AND created_by = ?1 AND ${PENDING}`;

const OWNED = 'SELECT 1 FROM friend_invitations WHERE id = ?3 AND created_by = ?1';

// An invitation with what decides whether it can still be taken
interface InvitationState {
    id: string;
    // The friend it made, once it was accepted
    groupId: string | null;
    acceptedBy: string | null;
    // Nobody answered or revoked it, it hasn't expired and who asks is still a user
    open: boolean;
    // The user who asks to be friends
    inviter: string | null;
}

// A person who takes an invitation, under the name they start with in the friend
interface Taker {
    userId: string;
    name: string;
}

// ?2 is the time now
const OPEN = `
    i.accepted_at IS NULL AND i.declined_at IS NULL AND i.revoked_at IS NULL
    AND i.expires_at > ?2 AND i.created_by IS NOT NULL`;

const READ = `
    SELECT i.id, i.group_id AS groupId, i.accepted_by AS acceptedBy, (${OPEN}) AS open, i.created_by AS inviter
    FROM friend_invitations i WHERE i.id = ?1`;

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
    SELECT i.id FROM friend_invitations i
    WHERE i.id = ?1 AND ${OPEN} AND i.created_by <> ?3 AND NOT EXISTS (${friendsQuery('i.created_by', '?3')})`;

// The friend ?4, written first, as the invitation points at it, and only while the invitation can be taken; nothing
// runs between the statements of a batch, so the mark that follows reads the same
const INSERT_FRIEND = `
    INSERT INTO shared_groups (id, kind, name, currency, created_by, created_at, updated_at)
    SELECT ?4, 'direct', NULL, ?5, i.created_by, ?2, ?2 FROM friend_invitations i
    WHERE i.id IN (${TAKEABLE})`;

const TAKE = `
    UPDATE friend_invitations SET accepted_by = ?3, accepted_at = ?2, group_id = ?4
    WHERE id = (${TAKEABLE})`;

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
    WHERE id = (SELECT i.id FROM friend_invitations i WHERE i.id = ?1 AND ${OPEN} AND i.created_by <> ?3)`;

const readInvitation = async (db: D1Database, id: string): Promise<InvitationState | null> => {
    const row = await db.prepare(READ).bind(id, Date.now()).first<Omit<InvitationState, 'open'> & { open: number }>();
    return row ? { ...row, open: row.open === 1 } : null;
};

const areFriends = async (db: D1Database, one: string, other: string): Promise<boolean> => {
    return (await db.prepare(friendsQuery('?1', '?2')).bind(one, other).first()) !== null;
};

// The friend an invitation made, in the app's currency, with who asked under `inviterName`; or null, with nothing
// written, when it could no longer be used or the two became friends meanwhile
const acceptInvitation = async (
    db: D1Database,
    id: string,
    taker: Taker,
    inviterName: string
): Promise<string | null> => {
    const at = Date.now();
    const friendId = crypto.randomUUID();
    const [, taken] = await db.batch([
        db.prepare(INSERT_FRIEND).bind(id, at, taker.userId, friendId, DEFAULT_CURRENCY),
        db.prepare(TAKE).bind(id, at, taker.userId, friendId),
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

// A link to be friends with nobody behind it, or null when the person has as many open as there can be. The person's own
// links that ended long ago go with it, so the table doesn't grow with every link made and revoked.
const createInvitation = async (
    db: D1Database,
    by: string,
    at: number
): Promise<{ id: string; expiresAt: number } | null> => {
    const id = crypto.randomUUID();
    const expiresAt = at + INVITATION_DAYS * DAY;
    const [, inserted] = await db.batch([
        db.prepare(PURGE_ENDED).bind(by, at - ENDED_INVITATION_DAYS * DAY),
        db.prepare(INSERT_INVITATION).bind(id, at, by, expiresAt),
    ]);
    return (inserted?.meta.changes ?? 0) > 0 ? { id, expiresAt } : null;
};

// The invitations of the person that can still be used, newest first
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

// Whether it is an invitation of the person's, which is then revoked if it was still open
const revokeInvitation = async (db: D1Database, userId: string, id: string): Promise<boolean> => {
    const now = Date.now();
    const [, own] = await db.batch([db.prepare(REVOKE).bind(userId, now, id), db.prepare(OWNED).bind(userId, now, id)]);
    return (own?.results.length ?? 0) > 0;
};

export {
    acceptInvitation,
    areFriends,
    createInvitation,
    declineInvitation,
    listPendingInvitations,
    readInvitation,
    revokeInvitation,
    type InvitationState,
};
