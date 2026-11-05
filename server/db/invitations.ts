import { INVITATION_DAYS } from '@core/invitation';

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

const endOf = (row: LatestRow): LatestInvitation['ended'] => {
    if (row.accepted_at !== null) return 'accepted';
    if (row.declined_at !== null) return 'declined';
    return row.revoked_at === null ? null : 'revoked';
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

export { createInvitation, latestInvitation, revokeInvitations };
