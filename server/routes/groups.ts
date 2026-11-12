import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { memberBalances } from '@core/balance';
import {
    MAX_CLOSED_GROUPS,
    MAX_OPEN_GROUPS,
    groupIdSchema,
    groupWriteSchema,
    mySwitchesSchema,
    ownerSchema,
    personName,
} from '@core/shared-group';
import { listLiveEntries } from '@server/db/entries';
import {
    changeGroup,
    closedFor,
    countClosedGroups,
    countOpenGroups,
    createGroup,
    deleteGroup,
    listGroups,
    manages,
    readGroup,
    readSharedGroup,
} from '@server/db/groups';
import { handOver, pinMember, saveMySwitches } from '@server/db/members';
import { readProfile } from '@server/db/profile';

import type { AppEnv } from '@server/env';

const groupParam = sValidator('param', v.object({ groupId: groupIdSchema }));

// The same answer whether the group doesn't exist or the caller has never been in it, so that its existence isn't told
const NOT_FOUND = { error: 'not-found' } as const;

// A write to a group that was deleted, or that the caller left
const CLOSED = { error: 'closed' } as const;

const groupsRoutes = new Hono<AppEnv>()
    .get('/', async (c) => c.json({ groups: await listGroups(c.env.DB, c.var.userId) }))
    .put('/:groupId', groupParam, sValidator('json', groupWriteSchema), async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId } = c.req.valid('param');
        const input = c.req.valid('json');
        const state = await readGroup(db, userId, groupId);

        if (!state) {
            if (input.kind === undefined) return c.json(NOT_FOUND, 404);
            if ((await countOpenGroups(db, userId, 'group')) >= MAX_OPEN_GROUPS) {
                return c.json({ error: 'too-many-groups' }, 409);
            }
            if ((await countClosedGroups(db, userId)) >= MAX_CLOSED_GROUPS) {
                return c.json({ error: 'too-many-closed-groups' }, 409);
            }
            const maker = { userId, name: personName(await readProfile(db, userId)) };
            // The same write sent at the same moment may have made it first
            const made = await createGroup(db, maker, groupId, input);
            if (made === 'id-taken' && !(await readGroup(db, userId, groupId))) {
                return c.json({ error: 'id-taken' }, 409);
            }
            return c.json(await readSharedGroup(db, userId, groupId), 200);
        }

        // A friend has no name, and a new group sent again changes only its name
        const name = state.group.kind === 'group' && input.name && input.name !== state.group.name ? input.name : null;
        const wanted = input.kind === undefined ? input.simplifyDebts : undefined;
        const simplifyDebts = wanted === undefined || wanted === state.group.simplifyDebts ? null : wanted;
        if (name === null && simplifyDebts === null) return c.json(await readSharedGroup(db, userId, groupId), 200);
        if (closedFor(state)) return c.json(CLOSED, 409);
        if (!manages(state)) return c.json({ error: 'not-owner' }, 403);

        await changeGroup(db, groupId, { name, simplifyDebts });
        return c.json(await readSharedGroup(db, userId, groupId), 200);
    })
    .delete('/:groupId', groupParam, async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId } = c.req.valid('param');
        const state = await readGroup(db, userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        // A person who left is not told whether the group was deleted since
        if (state.me.leftAt !== null) return c.json(CLOSED, 409);

        if (state.group.deletedAt === null) {
            if (!manages(state)) return c.json({ error: 'not-owner' }, 403);
            // Closing with a balance hurts nobody when the caller is the only user still in the group
            const users = state.members.filter((member) => member.userId !== null && member.leftAt === null);
            if (users.length > 1) {
                const balances = memberBalances(await listLiveEntries(db, groupId), state.members);
                if (balances.some((balance) => balance.cents !== 0)) return c.json({ error: 'unsettled' }, 409);
            }
            await deleteGroup(db, groupId);
        }
        return c.json(await readSharedGroup(db, userId, groupId), 200);
    })
    .post('/:groupId/owner', groupParam, sValidator('json', ownerSchema), async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId } = c.req.valid('param');
        const { memberId } = c.req.valid('json');
        const state = await readGroup(db, userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        // Before anything is looked up, so a person who left learns nothing of what came after
        if (closedFor(state)) return c.json(CLOSED, 409);
        const target = state.members.find((member) => member.id === memberId);
        if (!target) return c.json({ error: 'unknown-member' }, 422);

        if (target.role !== 'owner') {
            if (state.group.kind === 'direct') return c.json({ error: 'direct' }, 409);
            if (!manages(state)) return c.json({ error: 'not-owner' }, 403);
            if (target.leftAt !== null) return c.json({ error: 'member-left' }, 422);
            if (target.userId === null) return c.json({ error: 'not-a-user' }, 409);
            // The target may have left since the group was read
            if (!(await handOver(db, groupId, target.id))) return c.json({ error: 'member-left' }, 422);
        }
        return c.json(await readSharedGroup(db, userId, groupId), 200);
    })
    // The caller's own switches, which a closed group keeps too
    .put('/:groupId/me', groupParam, sValidator('json', mySwitchesSchema), async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId } = c.req.valid('param');
        const input = c.req.valid('json');
        const state = await readGroup(db, userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);

        if (input.archived && !closedFor(state)) return c.json({ error: 'not-closed' }, 409);
        if (input.pinned && closedFor(state)) return c.json(CLOSED, 409);
        const pins = input.pinned && state.me.pinnedAt === null;
        if (pins && !(await pinMember(db, userId, state.me.id))) return c.json({ error: 'too-many-pinned' }, 409);
        await saveMySwitches(db, state.me.id, input);
        return c.json(await readSharedGroup(db, userId, groupId), 200);
    });

export { CLOSED, NOT_FOUND, groupsRoutes };
