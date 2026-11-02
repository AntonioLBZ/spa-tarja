import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { memberBalances } from '@core/balance';
import {
    MAX_GROUP_MEMBERS,
    MAX_OPEN_GROUPS,
    groupIdSchema,
    memberIdSchema,
    memberWriteSchema,
    mergeSchema,
} from '@core/shared-group';
import { listLiveEntries } from '@server/db/entries';
import { closedFor, countOpenGroups, manages, readGroup, readSharedGroup, type GroupState } from '@server/db/groups';
import { addFriend, addPlaceholder, findFriend, leaveGroup, mergeMember, renameMember } from '@server/db/members';

import { CLOSED, NOT_FOUND } from './groups';

import type { AppEnv } from '@server/env';

const memberParam = sValidator('param', v.object({ groupId: groupIdSchema, memberId: memberIdSchema }));

// Those who count toward the limit of a group
const openMembers = ({ members }: GroupState): number => {
    return members.filter((member) => member.leftAt === null).length;
};

const membersRoutes = new Hono<AppEnv>()
    .put('/:groupId/members/:memberId', memberParam, sValidator('json', memberWriteSchema), async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId, memberId } = c.req.valid('param');
        const input = c.req.valid('json');
        const state = await readGroup(db, userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);

        const existing = state.members.find((member) => member.id === memberId);
        const added = { id: memberId, groupId, by: userId, at: Date.now() };
        const answer = async () => c.json(await readSharedGroup(db, userId, groupId), 200);

        if (input.friend === undefined) {
            if (existing?.name === input.name) return answer();
            if (closedFor(state)) return c.json(CLOSED, 409);
            if (existing) {
                if (!manages(state) && existing.id !== state.me.id) return c.json({ error: 'not-owner' }, 403);
                await renameMember(db, memberId, input.name);
                return answer();
            }
            if (state.group.kind === 'direct') return c.json({ error: 'direct' }, 409);
            if (openMembers(state) >= MAX_GROUP_MEMBERS) return c.json({ error: 'too-many-members' }, 409);
            if ((await addPlaceholder(db, added, input.name)) === 'id-taken') return c.json({ error: 'id-taken' }, 409);
            return answer();
        }

        if (existing) {
            const friend = await findFriend(db, userId, input.friend);
            const sentAgain = existing.userId !== null && existing.userId === friend?.userId;
            return sentAgain ? answer() : c.json({ error: 'id-taken' }, 409);
        }
        if (closedFor(state)) return c.json(CLOSED, 409);
        if (state.group.kind === 'direct') return c.json({ error: 'direct' }, 409);
        const friend = await findFriend(db, userId, input.friend);
        if (!friend) return c.json({ error: 'unknown-friend' }, 422);
        const friendUser = friend.userId;
        if (friendUser === null) return c.json({ error: 'not-a-user' }, 409);
        if (state.members.some((member) => member.userId === friendUser)) {
            return c.json({ error: 'already-member' }, 409);
        }

        if (input.replaces === undefined) {
            if (openMembers(state) >= MAX_GROUP_MEMBERS) return c.json({ error: 'too-many-members' }, 409);
        } else {
            const dummy = state.members.find((member) => member.id === input.replaces);
            if (!dummy) return c.json({ error: 'unknown-member' }, 422);
            if (dummy.leftAt !== null) return c.json({ error: 'member-left' }, 422);
            if (dummy.claimed) return c.json({ error: 'not-placeholder' }, 409);
        }
        if ((await countOpenGroups(db, friendUser, 'group')) >= MAX_OPEN_GROUPS) {
            return c.json({ error: 'too-many-groups' }, 409);
        }

        if ((await addFriend(db, added, friendUser, input.replaces ?? null)) === 'id-taken') {
            return c.json({ error: 'id-taken' }, 409);
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
        const dummy = state.members.find((member) => member.id === memberId);
        if (!dummy) return c.json({ error: 'unknown-member' }, 404);

        // Only a placeholder, only into a user, so a merge is one step and never a chain (ADR-0014)
        if (dummy.mergedInto !== into) {
            if (closedFor(state)) return c.json(CLOSED, 409);
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
        if (!target) return c.json({ error: 'unknown-member' }, 404);

        if (target.leftAt === null) {
            if (closedFor(state)) return c.json(CLOSED, 409);
            if (state.group.kind === 'direct') return c.json({ error: 'direct' }, 409);
            if (target.id !== state.me.id && !manages(state)) return c.json({ error: 'not-owner' }, 403);
            if (target.id === state.me.id && state.me.role === 'owner') return c.json({ error: 'owner' }, 409);
            const balances = memberBalances(await listLiveEntries(db, groupId), state.members);
            if (balances.some((balance) => balance.memberId === target.id && balance.cents !== 0)) {
                return c.json({ error: 'unsettled' }, 409);
            }
            await leaveGroup(db, target.id);
        }
        return c.json(await readSharedGroup(db, userId, groupId), 200);
    });

export { membersRoutes };
