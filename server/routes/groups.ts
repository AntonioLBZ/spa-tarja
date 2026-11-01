import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { MAX_FRIENDS, MAX_OPEN_GROUPS, groupIdSchema, groupWriteSchema } from '@core/shared-group';
import {
    changeGroup,
    countOpenGroups,
    createGroup,
    listGroups,
    manages,
    readGroup,
    readSharedGroup,
} from '@server/db/groups';

import type { AppEnv } from '@server/env';

const groupParam = sValidator('param', v.object({ groupId: groupIdSchema }));

// The same answer whether the group doesn't exist or the caller has never been in it, so that its existence isn't told
const NOT_FOUND = { error: 'not-found' } as const;

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
            const [limit, error] =
                input.kind === 'group' ? [MAX_OPEN_GROUPS, 'too-many-groups'] : [MAX_FRIENDS, 'too-many-friends'];
            if ((await countOpenGroups(db, userId, input.kind)) >= limit) return c.json({ error }, 409);
            if ((await createGroup(db, userId, groupId, input)) === 'id-taken') {
                return c.json({ error: 'id-taken' }, 409);
            }
            return c.json(await readSharedGroup(db, userId, groupId), 200);
        }

        // A friend has no name, and a new group sent again changes only its name
        const name = state.group.kind === 'group' && input.name && input.name !== state.group.name ? input.name : null;
        const wanted = input.kind === undefined ? input.simplifyDebts : undefined;
        const simplifyDebts = wanted === undefined || wanted === state.group.simplifyDebts ? null : wanted;
        if (name === null && simplifyDebts === null) return c.json(await readSharedGroup(db, userId, groupId), 200);
        if (!manages(state)) return c.json({ error: 'not-owner' }, 403);

        await changeGroup(db, groupId, { name, simplifyDebts });
        return c.json(await readSharedGroup(db, userId, groupId), 200);
    });

export { groupsRoutes };
