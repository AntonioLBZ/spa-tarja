import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { groupIdSchema } from '@core/shared-group';
import { closedFor, readGroup, type GroupState } from '@server/db/groups';
import { createInvitation, latestInvitation, revokeInvitations } from '@server/db/invitations';
import { signInvitation } from '@server/invitation-token';

import { CLOSED, NOT_FOUND } from './groups';

import type { FriendInvitation } from '@core/invitation';
import type { AppEnv } from '@server/env';

const groupParam = sValidator('param', v.object({ groupId: groupIdSchema }));

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

export { friendInvitationsRoutes };
