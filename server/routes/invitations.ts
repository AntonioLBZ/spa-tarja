import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import * as v from 'valibot';

import { invitationIdSchema, invitationTokenSchema } from '@core/invitation';
import { MAX_CLOSED_GROUPS, MAX_FRIENDS, personName } from '@core/shared-group';
import { countClosedGroups, countOpenGroups, readSharedGroup } from '@server/db/groups';
import {
    acceptInvitation,
    areFriends,
    createInvitation,
    declineInvitation,
    listPendingInvitations,
    readInvitation,
    revokeInvitation,
} from '@server/db/invitations';
import { readProfile } from '@server/db/profile';
import { readInvitationToken, signInvitation } from '@server/invitation-token';

import { NOT_FOUND } from './groups';

import type { InvitationView, PendingInvitation } from '@core/invitation';
import type { AppEnv } from '@server/env';

// What holds a link or its token is never kept by a cache on the way
const noStore = createMiddleware<AppEnv>(async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
});

const tokenBody = sValidator('json', invitationTokenSchema);

const invitationParam = sValidator('param', v.object({ invitationId: invitationIdSchema }));

// A link that doesn't exist, was forged, expired, was revoked, answered or used, or whose maker is gone: the same answer
// for all of them, so that a token can't be told from a missing one
const GONE = { error: 'gone' } as const;

const YOURSELF = { error: 'yourself' } as const;

const ALREADY_FRIENDS = { error: 'already-friends' } as const;

// Who asks can't take another friend now: one answer for every limit of theirs, so that it tells no more than that
const INVITER_AT_LIMIT = { error: 'inviter-at-limit' } as const;

// Why a person can't take another friend: as many open as there can be, or as many closed groups
const friendLimitOf = async (
    db: D1Database,
    userId: string
): Promise<'too-many-friends' | 'too-many-closed-groups' | null> => {
    if ((await countOpenGroups(db, userId, 'direct')) >= MAX_FRIENDS) return 'too-many-friends';
    return (await countClosedGroups(db, userId)) >= MAX_CLOSED_GROUPS ? 'too-many-closed-groups' : null;
};

// The invitations of the person that can still be used, each with its link
const pendingOf = async (env: Env, userId: string): Promise<PendingInvitation[]> => {
    const pending = await listPendingInvitations(env.DB, userId);
    return Promise.all(
        pending.map(async ({ id, expiresAt }) => ({
            id,
            token: await signInvitation(env.BETTER_AUTH_SECRET, id),
            expiresAt,
        }))
    );
};

// The invitation a link names, when the server signed its token
const invitationOf = async (env: Env, token: unknown) => {
    const id = typeof token === 'string' ? await readInvitationToken(env.BETTER_AUTH_SECRET, token) : null;
    return id === null ? null : readInvitation(env.DB, id);
};

// The person's own links to be friends, and what the person who opened a link does with it. The token comes in the
// body, so that no URL holds it.
const invitationsRoutes = new Hono<AppEnv>()
    .use(noStore)
    .get('/', async (c) => c.json({ invitations: await pendingOf(c.env, c.var.userId) }, 200))
    .post('/', async (c) => {
        const userId = c.var.userId;
        const limit = await friendLimitOf(c.env.DB, userId);
        if (limit) return c.json({ error: limit }, 409);
        const made = await createInvitation(c.env.DB, userId, Date.now());
        if (!made) return c.json({ error: 'too-many-invitations' }, 409);
        const invitation: PendingInvitation = {
            id: made.id,
            token: await signInvitation(c.env.BETTER_AUTH_SECRET, made.id),
            expiresAt: made.expiresAt,
        };
        return c.json({ invitation }, 200);
    })
    // Another person's invitation is not found, as one that doesn't exist
    .delete('/:invitationId', invitationParam, async (c) => {
        const userId = c.var.userId;
        const own = await revokeInvitation(c.env.DB, userId, c.req.valid('param').invitationId);
        if (!own) return c.json(NOT_FOUND, 404);
        return c.json({ invitations: await pendingOf(c.env, userId) }, 200);
    })
    .post('/read', tokenBody, async (c) => {
        const invitation = await invitationOf(c.env, c.req.valid('json').token);
        if (!invitation?.open || invitation.inviter === null) return c.json(GONE, 410);
        if (invitation.inviter === c.var.userId) return c.json(YOURSELF, 409);
        const view: InvitationView = { name: personName(await readProfile(c.env.DB, invitation.inviter)) };
        return c.json(view, 200);
    })
    .post('/accept', tokenBody, async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const invitation = await invitationOf(c.env, c.req.valid('json').token);
        if (!invitation) return c.json(GONE, 410);
        const answer = async (friendId: string) => c.json(await readSharedGroup(db, userId, friendId), 200);

        // Sent again after an answer that never came
        if (invitation.acceptedBy === userId && invitation.groupId !== null) return answer(invitation.groupId);
        const { inviter } = invitation;
        if (!invitation.open || inviter === null) return c.json(GONE, 410);
        if (inviter === userId) return c.json(YOURSELF, 409);
        if (await areFriends(db, inviter, userId)) return c.json(ALREADY_FRIENDS, 409);

        // A friend needs room on both sides
        const limit = await friendLimitOf(db, userId);
        if (limit) return c.json({ error: limit }, 409);
        if (await friendLimitOf(db, inviter)) return c.json(INVITER_AT_LIMIT, 409);

        const taker = { userId, name: personName(await readProfile(db, userId)) };
        const inviterName = personName(await readProfile(db, inviter));
        const friendId = await acceptInvitation(db, invitation.id, taker, inviterName);
        if (friendId !== null) return answer(friendId);

        // Taken or revoked meanwhile, or the two made friends through another link at the same moment
        const now = await readInvitation(db, invitation.id);
        if (now?.acceptedBy === userId && now.groupId !== null) return answer(now.groupId);
        if (now?.open && now.inviter !== null && (await areFriends(db, now.inviter, userId))) {
            return c.json(ALREADY_FRIENDS, 409);
        }
        return c.json(GONE, 410);
    })
    .post('/decline', tokenBody, async (c) => {
        const invitation = await invitationOf(c.env, c.req.valid('json').token);
        if (!invitation?.open || invitation.inviter === null) return c.json(GONE, 410);
        if (invitation.inviter === c.var.userId) return c.json(YOURSELF, 409);
        const declined = await declineInvitation(c.env.DB, invitation.id, c.var.userId);
        return declined ? c.body(null, 204) : c.json(GONE, 410);
    });

export { invitationsRoutes };
