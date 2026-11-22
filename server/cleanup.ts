import { purgeEndedInvitations } from '@server/db/invitations';

// How many rows the daily clean-up deleted from each table
interface CleanupCounts {
    sessions: number;
    verifications: number;
    invitations: number;
}

// What has ended and nothing reads any more: the sessions past their end, the records of sign-ins that were never
// finished, and the invitations that ended long ago without being accepted. Better Auth keeps its dates as ISO text in
// UTC, which sorts as the time does. Push subscriptions are not touched: one that a push service says is gone is deleted
// when it answers so.
const dailyCleanup = async (db: D1Database, now: number): Promise<CleanupCounts> => {
    const at = new Date(now).toISOString();
    const [sessions, verifications, invitations] = await db.batch([
        db.prepare('DELETE FROM "session" WHERE "expiresAt" < ?1').bind(at),
        db.prepare('DELETE FROM "verification" WHERE "expiresAt" < ?1').bind(at),
        purgeEndedInvitations(db, now),
    ]);
    return {
        sessions: sessions?.meta.changes ?? 0,
        verifications: verifications?.meta.changes ?? 0,
        invitations: invitations?.meta.changes ?? 0,
    };
};

export { dailyCleanup, type CleanupCounts };
