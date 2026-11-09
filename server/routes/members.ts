import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { memberBalances } from '@core/balance';
import {
    MAX_CLOSED_GROUPS,
    MAX_OPEN_GROUPS,
    groupIdSchema,
    memberIdSchema,
    memberWriteSchema,
    mergeSchema,
    personName,
} from '@core/shared-group';
import { listLiveEntries } from '@server/db/entries';
import { closedFor, countClosedGroups, countOpenGroups, manages, readGroup, readSharedGroup } from '@server/db/groups';
import {
    addFriend,
    addPlaceholder,
    findFriend,
    leaveGroup,
    mergeMember,
    renameMember,
    reopenMember,
} from '@server/db/members';
import { readProfile } from '@server/db/profile';

import { CLOSED, NOT_FOUND } from './groups';

import type { AppEnv } from '@server/env';

const memberParam = sValidator('param', v.object({ groupId: groupIdSchema, memberId: memberIdSchema }));

const membersRoutes = new Hono<AppEnv>()
    .put('/:groupId/members/:memberId', memberParam, sValidator('json', memberWriteSchema), async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId, memberId } = c.req.valid('param');
        const input = c.req.valid('json');
        const state = await readGroup(db, userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        if (closedFor(state)) return c.json(CLOSED, 409);

        const existing = state.members.find((member) => member.id === memberId);
        const added = { id: memberId, groupId, by: userId, at: Date.now() };
        const answer = async () => c.json(await readSharedGroup(db, userId, groupId), 200);

        if (input.friend === undefined) {
            if (existing?.name === input.name) return answer();
            if (existing) {
                if (!manages(state) && existing.id !== state.me.id) return c.json({ error: 'not-owner' }, 403);
                await renameMember(db, memberId, input.name);
                return answer();
            }
            if (state.group.kind === 'direct') return c.json({ error: 'direct' }, 409);
            const result = await addPlaceholder(db, added, input.name);
            if (result === 'full') return c.json({ error: 'too-many-members' }, 409);
            if (result === 'too-many-ever') return c.json({ error: 'too-many-members-ever' }, 409);
            // The same write sent at the same moment may have added it first
            if (result === 'id-taken') {
                const now = await readGroup(db, userId, groupId);
                const landed = now?.members.find((member) => member.id === memberId);
                if (landed?.name !== input.name) return c.json({ error: 'id-taken' }, 409);
            }
            return answer();
        }

        if (existing) {
            const friend = await findFriend(db, userId, input.friend);
            const sentAgain = existing.userId === friend?.userId;
            return sentAgain ? answer() : c.json({ error: 'id-taken' }, 409);
        }
        if (state.group.kind === 'direct') return c.json({ error: 'direct' }, 409);
        const friend = await findFriend(db, userId, input.friend);
        if (!friend) return c.json({ error: 'unknown-friend' }, 422);
        const friendUser = friend.userId;
        // A person has one row in a group for good, so one who left comes back by reopening it
        const known = state.members.find((member) => member.userId === friendUser);
        if (known?.leftAt === null) return c.json({ error: 'already-member' }, 409);

        if (input.replaces !== undefined) {
            // In place of a dummy is a merge, which only the owner makes
            if (!manages(state)) return c.json({ error: 'not-owner' }, 403);
            const dummy = state.members.find((member) => member.id === input.replaces);
            if (!dummy) return c.json({ error: 'unknown-member' }, 422);
            if (dummy.leftAt !== null) return c.json({ error: 'member-left' }, 422);
            if (dummy.claimed) return c.json({ error: 'not-placeholder' }, 409);
        }
        if ((await countOpenGroups(db, friendUser, 'group')) >= MAX_OPEN_GROUPS) {
            return c.json({ error: 'too-many-groups' }, 409);
        }

        if (known) {
            // The closed group they leave behind is this one, and no row is made
            if (await reopenMember(db, known.id, input.replaces ?? null, added.at)) return answer();
            // Another request may have brought them back first, or closed the group, or filled it
            const now = await readGroup(db, userId, groupId);
            if (!now || closedFor(now)) return c.json(CLOSED, 409);
            const back = now.members.find((member) => member.id === known.id);
            return c.json({ error: back?.leftAt === null ? 'already-member' : 'too-many-members' }, 409);
        }

        if ((await countClosedGroups(db, friendUser)) >= MAX_CLOSED_GROUPS) {
            return c.json({ error: 'too-many-closed-groups' }, 409);
        }

        const person = { userId: friendUser, name: personName(await readProfile(db, friendUser)) };
        const result = await addFriend(db, added, person, input.replaces ?? null);
        if (result === 'full') return c.json({ error: 'too-many-members' }, 409);
        if (result === 'too-many-ever') return c.json({ error: 'too-many-members-ever' }, 409);
        if (result === 'id-taken') {
            // The same write sent at the same moment may have added them first
            const now = await readGroup(db, userId, groupId);
            if (now?.members.find((member) => member.id === memberId)?.userId === friendUser) return answer();
            const already = now?.members.some((member) => member.userId === friendUser);
            return c.json({ error: already ? 'already-member' : 'id-taken' }, 409);
        }
        return answer();
    })
    .post('/:groupId/members/:memberId/merge', memberParam, sValidator('json', mergeSchema), async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId, memberId } = c.req.valid('param');
        const { into } = c.req.valid('json');
        const state = await readGroup(db, userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        // Before anything is looked up, so a person who left learns nothing of what came after
        if (closedFor(state)) return c.json(CLOSED, 409);
        const dummy = state.members.find((member) => member.id === memberId);
        if (!dummy) return c.json({ error: 'unknown-member' }, 404);

        // Only a placeholder, only into a user, so a merge is one step and never a chain (ADR-0014)
        if (dummy.mergedInto !== into) {
            if (state.group.kind === 'direct') return c.json({ error: 'direct' }, 409);
            if (!manages(state)) return c.json({ error: 'not-owner' }, 403);
            if (into === dummy.id) return c.json({ error: 'into-itself' }, 409);
            if (dummy.claimed) return c.json({ error: 'not-placeholder' }, 409);
            if (dummy.leftAt !== null) return c.json({ error: 'member-left' }, 409);
            const target = state.members.find((member) => member.id === into);
            if (!target) return c.json({ error: 'unknown-member' }, 422);
            if (target.leftAt !== null) return c.json({ error: 'member-left' }, 422);
            if (target.userId === null) return c.json({ error: 'not-a-user' }, 409);
            await mergeMember(db, dummy.id, target.id);
        }
        return c.json(await readSharedGroup(db, userId, groupId), 200);
    })
    .delete('/:groupId/members/:memberId', memberParam, async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId, memberId } = c.req.valid('param');
        const state = await readGroup(db, userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        const target = state.members.find((member) => member.id === memberId);
        // Before anything else is told, so a person who left learns nothing of what came after; only their own leave,
        // sent again, is answered
        const ownLeave = target !== undefined && target.id === state.me.id && target.leftAt !== null;
        if (closedFor(state) && !ownLeave) return c.json(CLOSED, 409);
        if (!target) return c.json({ error: 'unknown-member' }, 404);

        if (target.leftAt === null) {
            if (state.group.kind === 'direct') return c.json({ error: 'direct' }, 409);
            if (target.id !== state.me.id && !manages(state)) return c.json({ error: 'not-owner' }, 403);
            if (target.id === state.me.id && state.me.role === 'owner') return c.json({ error: 'owner' }, 409);
            const balances = memberBalances(await listLiveEntries(db, groupId), state.members);
            if (balances.some((balance) => balance.memberId === target.id && balance.cents !== 0)) {
                return c.json({ error: 'unsettled' }, 409);
            }
            // The member may have been made the owner since the group was read
            if (!(await leaveGroup(db, target.id))) {
                const now = await readGroup(db, userId, groupId);
                if (now?.members.find((member) => member.id === target.id)?.role === 'owner') {
                    return c.json({ error: 'owner' }, 409);
                }
            }
        }
        return c.json(await readSharedGroup(db, userId, groupId), 200);
    });

export { membersRoutes };
