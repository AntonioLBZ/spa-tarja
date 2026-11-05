import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { invitationTokenSchema } from '@core/invitation';
import { MAX_FRIENDS, groupIdSchema, personName } from '@core/shared-group';
import { closedFor, countOpenGroups, readGroup, readSharedGroup, type GroupState } from '@server/db/groups';
import {
    acceptInvitation,
    areFriends,
    createInvitation,
    declineInvitation,
    latestInvitation,
    readInvitation,
    revokeInvitations,
} from '@server/db/invitations';
import { readProfile } from '@server/db/profile';
import { readInvitationToken, signInvitation } from '@server/invitation-token';

import { CLOSED, NOT_FOUND } from './groups';

import type { FriendInvitation, InvitationView } from '@core/invitation';
import type { AppEnv } from '@server/env';

const groupParam = sValidator('param', v.object({ groupId: groupIdSchema }));

const tokenBody = sValidator('json', invitationTokenSchema);

// A link that doesn't exist, was forged, expired, was revoked, answered or used, or whose friend or dummy is gone: the
// same answer for all of them, so that a token can't be told from a missing one
const GONE = { error: 'gone' } as const;

const YOURSELF = { error: 'yourself' } as const;

const ALREADY_FRIENDS = { error: 'already-friends' } as const;

// The dummy an invitation of this friend is for: the other side of an open friend, while nobody has taken its place
const dummyOf = (state: GroupState) => {
    if (closedFor(state) !== null || state.group.kind !== 'direct') return null;
    return state.members.find((member) => member.id !== state.me.id && !member.claimed) ?? null;
};

// The invitation of a friend made last as its members see it: its link while it can be used, or that it was declined
const friendInvitation = async (env: Env, state: GroupState): Promise<FriendInvitation | null> => {
    if (!dummyOf(state)) return null;
    const latest = await latestInvitation(env.DB, state.group.id);
    if (latest?.ended === 'declined') return { state: 'declined' };
    if (!latest || latest.ended !== null || latest.expiresAt <= Date.now()) return null;
    return {
        state: 'open',
        token: await signInvitation(env.BETTER_AUTH_SECRET, latest.id),
        expiresAt: latest.expiresAt,
    };
};

// The invitations of a friend, for its members: the token is answered only to them, in a body, never in a URL
const friendInvitationsRoutes = new Hono<AppEnv>()
    .get('/:groupId/invitations', groupParam, async (c) => {
        const state = await readGroup(c.env.DB, c.var.userId, c.req.valid('param').groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        return c.json({ invitation: await friendInvitation(c.env, state) }, 200);
    })
    .post('/:groupId/invitations', groupParam, async (c) => {
        const state = await readGroup(c.env.DB, c.var.userId, c.req.valid('param').groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        if (closedFor(state)) return c.json(CLOSED, 409);
        if (state.group.kind !== 'direct') return c.json({ error: 'not-a-friend' }, 409);
        const dummy = dummyOf(state);
        if (!dummy) return c.json({ error: 'not-placeholder' }, 409);

        const at = Date.now();
        const made = await createInvitation(c.env.DB, {
            groupId: state.group.id,
            memberId: dummy.id,
            by: c.var.userId,
            at,
        });
        const token = await signInvitation(c.env.BETTER_AUTH_SECRET, made.id);
        return c.json(
            { invitation: { state: 'open', token, expiresAt: made.expiresAt } satisfies FriendInvitation },
            200
        );
    })
    // Revoking what is there already, or a friend's that is gone with the friend, changes nothing
    .delete('/:groupId/invitations', groupParam, async (c) => {
        const state = await readGroup(c.env.DB, c.var.userId, c.req.valid('param').groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        if (dummyOf(state)) await revokeInvitations(c.env.DB, state.group.id);
        return c.json({ invitation: await friendInvitation(c.env, state) }, 200);
    });

// The invitation a link names, when the server signed its token
const invitationOf = async (env: Env, token: string) => {
    const id = await readInvitationToken(env.BETTER_AUTH_SECRET, token);
    return id === null ? null : readInvitation(env.DB, id);
};

// What the person who opened a link does with it. The token comes in the body, so that no URL holds it.
const invitationsRoutes = new Hono<AppEnv>()
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
        const answer = async () => c.json(await readSharedGroup(db, userId, invitation.groupId), 200);

        // Sent again after an answer that never came
        if (invitation.acceptedBy === userId) return answer();
        if (!invitation.open || invitation.inviter === null) return c.json(GONE, 410);
        if (invitation.inviter === userId) return c.json(YOURSELF, 409);
        if (await areFriends(db, invitation.inviter, userId)) return c.json(ALREADY_FRIENDS, 409);
        if ((await countOpenGroups(db, userId, 'direct')) >= MAX_FRIENDS) {
            return c.json({ error: 'too-many-friends' }, 409);
        }

        const taker = { userId, name: personName(await readProfile(db, userId)) };
        if (await acceptInvitation(db, invitation.id, taker)) return answer();
        // Taken, revoked or closed meanwhile, or the two made friends through another link at the same moment
        const now = await readInvitation(db, invitation.id);
        if (now?.acceptedBy === userId) return answer();
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

export { friendInvitationsRoutes, invitationsRoutes };
