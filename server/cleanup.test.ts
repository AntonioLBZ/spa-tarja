import { createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { ENDED_INVITATION_DAYS, INVITATION_DAYS } from '@core/invitation';
import { app } from '@server/app';
import { dailyCleanup } from '@server/cleanup';
import worker from '@server/index';
import { makeGroup } from '@server/test/groups';
import { ORIGIN, signIn, signInAgain, type TestSession } from '@server/test/session';

const DAY = 24 * 60 * 60 * 1000;

let ana: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
});

const count = async (table: string): Promise<number> => {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).first<{ n: number }>();
    return row?.n ?? 0;
};

const startSignIn = () => {
    return app.request(
        '/api/auth/sign-in/social',
        {
            method: 'POST',
            headers: { 'content-type': 'application/json', origin: ORIGIN },
            body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
        },
        env
    );
};

interface Invitation {
    endedAt: number;
    how: 'expired' | 'revoked' | 'declined' | 'accepted';
    by?: string | null;
}

const insertInvitation = async ({ endedAt, how, by }: Invitation) => {
    const id = crypto.randomUUID();
    const createdAt = how === 'expired' ? endedAt - INVITATION_DAYS * DAY : endedAt - DAY;
    const expiresAt = how === 'expired' ? endedAt : createdAt + INVITATION_DAYS * DAY;
    const group = how === 'accepted' ? (await makeGroup(ana, ['Bruno'])).id : null;
    await env.DB.prepare(
        `INSERT INTO friend_invitations (id, group_id, created_by, created_at, expires_at, accepted_by, accepted_at,
            declined_at, revoked_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
    )
        .bind(
            id,
            group,
            by === undefined ? ana.userId : by,
            createdAt,
            expiresAt,
            how === 'accepted' ? ana.userId : null,
            how === 'accepted' ? endedAt : null,
            how === 'declined' ? endedAt : null,
            how === 'revoked' ? endedAt : null
        )
        .run();
    return id;
};

const invitationIds = async (): Promise<string[]> => {
    const { results } = await env.DB.prepare('SELECT id FROM friend_invitations').all<{ id: string }>();
    return results.map((row) => row.id).sort();
};

describe('the daily clean-up', () => {
    it('deletes the sessions past their end and keeps the ones still open', async () => {
        await signInAgain(ana);
        const bruno = await signIn('bruno@example.com', 'Bruno Díaz');
        await env.DB.prepare('UPDATE "session" SET "expiresAt" = ?1 WHERE "userId" = ?2')
            .bind(new Date(Date.now() - 1000).toISOString(), ana.userId)
            .run();

        const counts = await dailyCleanup(env.DB, Date.now());

        expect(counts.sessions).toBe(2);
        const { results } = await env.DB.prepare('SELECT "userId" FROM "session"').all<{ userId: string }>();
        expect(results.map((row) => row.userId)).toEqual([bruno.userId]);
    });

    it('deletes a session once its end has passed, as Better Auth wrote it', async () => {
        expect(await count('session')).toBe(1);

        expect((await dailyCleanup(env.DB, Date.now())).sessions).toBe(0);
        expect((await dailyCleanup(env.DB, Date.now() + 31 * DAY)).sessions).toBe(1);
        expect(await count('session')).toBe(0);
    });

    it('deletes the records of a sign-in that was never finished once they expire', async () => {
        expect((await startSignIn()).status).toBe(200);
        expect(await count('verification')).toBe(1);

        expect((await dailyCleanup(env.DB, Date.now())).verifications).toBe(0);
        expect(await count('verification')).toBe(1);

        expect((await dailyCleanup(env.DB, Date.now() + DAY)).verifications).toBe(1);
        expect(await count('verification')).toBe(0);
    });

    it('deletes the invitations that ended long ago without being accepted, whoever made them', async () => {
        const now = Date.now();
        const long = now - ENDED_INVITATION_DAYS * DAY - 1;
        const recent = now - ENDED_INVITATION_DAYS * DAY + DAY;
        const gone = [
            await insertInvitation({ endedAt: long, how: 'expired' }),
            await insertInvitation({ endedAt: long, how: 'revoked' }),
            await insertInvitation({ endedAt: long, how: 'declined' }),
            await insertInvitation({ endedAt: long, how: 'expired', by: null }),
        ];
        const kept = [
            await insertInvitation({ endedAt: long, how: 'accepted' }),
            await insertInvitation({ endedAt: recent, how: 'expired' }),
            await insertInvitation({ endedAt: recent, how: 'revoked' }),
            await insertInvitation({ endedAt: now + DAY, how: 'expired' }),
        ];

        const counts = await dailyCleanup(env.DB, now);

        expect(counts.invitations).toBe(gone.length);
        expect(await invitationIds()).toEqual(kept.sort());
    });

    it('runs from the Cron Trigger of the Worker', async () => {
        await env.DB.prepare('UPDATE "session" SET "expiresAt" = ?1')
            .bind(new Date(Date.now() - 1000).toISOString())
            .run();
        const controller = createScheduledController({ scheduledTime: new Date(), cron: '0 4 * * *' });
        const ctx = createExecutionContext();

        await worker.scheduled(controller, env, ctx);
        await waitOnExecutionContext(ctx);

        expect(await count('session')).toBe(0);
    });
});
