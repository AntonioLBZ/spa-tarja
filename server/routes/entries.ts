import { sValidator } from '@hono/standard-validator';
import { Hono } from 'hono';
import * as v from 'valibot';

import { isDefaultCategoryId } from '@core/categories';
import { entryIdSchema, sharedEntryInputSchema } from '@core/shared-entry';
import { groupIdSchema } from '@core/shared-group';
import { canonicalMember } from '@core/shared-member';
import { readEntry, upsertEntry, type StoredEntry } from '@server/db/entries';
import { closedFor, readGroup, type GroupState } from '@server/db/groups';

import { CLOSED, NOT_FOUND } from './groups';

import type { LedgerEntry, SharedEntryInput } from '@core/shared-entry';
import type { AppEnv } from '@server/env';

const entryParam = sValidator('param', v.object({ groupId: groupIdSchema, id: entryIdSchema }));

// The id of an entry of another group, which tells only that the id is in use
const ID_TAKEN = { error: 'id-taken' } as const;

const namedIn = (entry: SharedEntryInput): string[] => [entry.paidBy, ...entry.shares.map((share) => share.memberId)];

// Why an entry can't name the members it names: one the group doesn't have, or one who left and that the stored entry
// didn't name already. A placeholder merged into a member stands for that member, in both.
const memberRefusal = (
    { members }: GroupState,
    entry: SharedEntryInput,
    stored: SharedEntryInput | null
): 'unknown-member' | 'member-left' | null => {
    const named = namedIn(entry);
    if (named.some((id) => !members.some((member) => member.id === id))) return 'unknown-member';
    const before = new Set(stored ? namedIn(stored).map((id) => canonicalMember(members, id)) : []);
    const left = named
        .map((id) => canonicalMember(members, id))
        .filter((id) => !before.has(id))
        .some((id) => members.find((member) => member.id === id)?.leftAt !== null);
    return left ? 'member-left' : null;
};

// What a write that changed nothing answers: the entry kept over it while the group is open; once it is closed for the
// caller, only this very write sent again, and only as far as the caller reads the group
const keptEntry = (state: GroupState, kept: StoredEntry | null, updatedAt: number): LedgerEntry | null => {
    if (!kept) return null;
    if (!closedFor(state)) return kept.entry;
    const reads = state.me.leftSeq === null || kept.seq <= state.me.leftSeq;
    return reads && kept.entry.updatedAt === updatedAt ? kept.entry : null;
};

const entriesRoutes = new Hono<AppEnv>().put(
    '/:groupId/entries/:id',
    entryParam,
    sValidator('json', sharedEntryInputSchema),
    async (c) => {
        const db = c.env.DB;
        const userId = c.var.userId;
        const { groupId, id } = c.req.valid('param');
        const input = c.req.valid('json');
        const state = await readGroup(db, userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        const stored = await readEntry(db, id);
        if (stored && stored.groupId !== groupId) return c.json(ID_TAKEN, 409);
        const answerKept = (current: GroupState, kept: StoredEntry | null) => {
            const entry = keptEntry(current, kept, input.updatedAt);
            return entry ? c.json(entry, 200) : c.json(CLOSED, 409);
        };
        if (closedFor(state)) return answerKept(state, stored);

        if (input.kind === 'expense' && !isDefaultCategoryId(input.categoryId)) {
            return c.json({ error: 'unknown-category' }, 400);
        }
        if (input.currency !== state.group.currency) return c.json({ error: 'currency-mismatch' }, 422);
        const refusal = memberRefusal(state, input, stored?.entry ?? null);
        if (refusal) return c.json({ error: refusal }, 422);
        const written = await upsertEntry(db, { groupId, id, userId }, input);
        if (written) return c.json(written, 200);

        // Nothing was written: the stored entry is as new, or since the reads above the id went to another group or the
        // group closed for the caller
        const [now, kept] = await Promise.all([readGroup(db, userId, groupId), readEntry(db, id)]);
        if (!now) return c.json(NOT_FOUND, 404);
        if (kept && kept.groupId !== groupId) return c.json(ID_TAKEN, 409);
        return answerKept(now, kept);
    }
);

export { entriesRoutes };
