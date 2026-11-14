import { sValidator } from '@hono/standard-validator';
import { Hono, type Context } from 'hono';
import * as v from 'valibot';

import { isDefaultCategoryId } from '@core/categories';
import { entryIdSchema, sharedEntryInputSchema } from '@core/shared-entry';
import { groupIdSchema } from '@core/shared-group';
import { canonicalMember } from '@core/shared-member';
import { listEntryChanges, readEntry, upsertEntry, type StoredEntry } from '@server/db/entries';
import { closedFor, readGroup, type GroupState } from '@server/db/groups';
import { notifyEntry } from '@server/push-notices';

import { DEFAULT_PAGE_SIZE, changesQuery } from './expenses';
import { CLOSED, NOT_FOUND } from './groups';

import type { LedgerEntry, SharedEntryInput } from '@core/shared-entry';
import type { AppEnv } from '@server/env';

const groupParam = sValidator('param', v.object({ groupId: groupIdSchema }));

const entryParam = sValidator('param', v.object({ groupId: groupIdSchema, id: entryIdSchema }));

// The id of an entry of another group, which tells only that the id is in use
const ID_TAKEN = { error: 'id-taken' } as const;

const namedIn = (entry: SharedEntryInput): string[] => [entry.paidBy, ...entry.shares.map((share) => share.memberId)];

// What an entry has a member pay and owe, the placeholders merged into them counted as them
const partOf = (members: GroupState['members'], entry: SharedEntryInput | null, memberId: string) => {
    const isThem = (id: string) => canonicalMember(members, id) === memberId;
    return {
        paid: entry && isThem(entry.paidBy) ? entry.amountCents : 0,
        owed: (entry?.shares ?? [])
            .filter((share) => isThem(share.memberId))
            .reduce((sum, share) => sum + share.cents, 0),
    };
};

// Why an entry can't name the members it names: one the group doesn't have, or a write that moves what a member who
// left pays or owes, so that nobody who left settled is handed a debt or a credit. A new entry can't name them at all;
// one that did keeps them as it had them, whether it is deleted or not. A placeholder merged into a member stands for
// that member.
const memberRefusal = (
    { members }: GroupState,
    entry: SharedEntryInput,
    stored: SharedEntryInput | null
): 'unknown-member' | 'member-left' | null => {
    if (namedIn(entry).some((id) => !members.some((member) => member.id === id))) return 'unknown-member';
    const named = [...namedIn(entry), ...(stored ? namedIn(stored) : [])].map((id) => canonicalMember(members, id));
    const moved = named.some((id) => {
        const member = members.find((candidate) => candidate.id === id);
        if (!member || member.leftAt === null) return false;
        const [now, before] = [partOf(members, entry, id), partOf(members, stored, id)];
        return now.paid !== before.paid || now.owed !== before.owed;
    });
    return moved ? 'member-left' : null;
};

// Whether the entry sets a card that isn't the caller's: only the payer says how they paid, so anybody else writes it
// paid now, or keeps the card the stored entry has for the same payer
const setsCardOfAnother = (
    { members, me }: GroupState,
    entry: SharedEntryInput,
    stored: SharedEntryInput | null
): boolean => {
    const payer = canonicalMember(members, entry.paidBy);
    if (entry.payment === 'direct' || payer === me.id) return false;
    const kept =
        stored !== null &&
        canonicalMember(members, stored.paidBy) === payer &&
        stored.payment === entry.payment &&
        stored.chargeDate === entry.chargeDate;
    return !kept;
};

// How far ahead of the server a device's clock may write: a later `updatedAt` would win over every edit until then
const CLOCK_SLACK_MS = 86_400_000;

// What a write that changed nothing answers: the entry kept over it while the group is open; once it is closed for the
// caller, only this very write sent again, and only as far as the caller reads the group
const keptEntry = (state: GroupState, kept: StoredEntry | null, updatedAt: number): LedgerEntry | null => {
    if (!kept) return null;
    if (!closedFor(state)) return kept.entry;
    const reads = state.me.leftSeq === null || kept.seq <= state.me.leftSeq;
    return reads && kept.entry.updatedAt === updatedAt ? kept.entry : null;
};

// Runs work after the answer is sent, while the request lives on; a push that fails is dropped, as the next sync brings
// the entry anyway
const afterAnswer = (c: Context<AppEnv>, work: Promise<void>) => {
    const settled = work.catch(() => undefined);
    try {
        c.executionCtx.waitUntil(settled);
    } catch {
        // No execution context, as in a request made straight to the app: the work runs on its own
    }
};

const entriesRoutes = new Hono<AppEnv>()
    // A member who left reads the group only up to its cursor the moment they left
    .get('/:groupId/entries', groupParam, sValidator('query', changesQuery), async (c) => {
        const { groupId } = c.req.valid('param');
        const { after = 0, limit = DEFAULT_PAGE_SIZE } = c.req.valid('query');
        const state = await readGroup(c.env.DB, c.var.userId, groupId);
        if (!state) return c.json(NOT_FOUND, 404);
        return c.json(await listEntryChanges(c.env.DB, groupId, { after, limit, until: state.me.leftSeq }), 200);
    })
    .put('/:groupId/entries/:id', entryParam, sValidator('json', sharedEntryInputSchema), async (c) => {
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
        if (input.updatedAt > Date.now() + CLOCK_SLACK_MS) return c.json({ error: 'clock-ahead' }, 422);

        if (input.kind === 'expense' && !isDefaultCategoryId(input.categoryId)) {
            return c.json({ error: 'unknown-category' }, 400);
        }
        // An expense stays an expense and a settlement a settlement: changing it is deleting it and entering another
        if (stored && stored.entry.kind !== input.kind) return c.json({ error: 'kind-fixed' }, 422);
        if (input.currency !== state.group.currency) return c.json({ error: 'currency-mismatch' }, 422);
        const refusal = memberRefusal(state, input, stored?.entry ?? null);
        if (refusal) return c.json({ error: refusal }, 422);
        if (setsCardOfAnother(state, input, stored?.entry ?? null)) return c.json({ error: 'not-the-payer' }, 422);
        const written = await upsertEntry(db, { groupId, id, userId }, input);
        if (written) {
            // A push for an entry this write made, after the answer (ADR-0025)
            if (!stored && written.deletedAt === null) afterAnswer(c, notifyEntry(c.env, state, written));
            return c.json(written, 200);
        }

        // Nothing was written: the stored entry is as new, or since the reads above the id went to another group or the
        // group closed for the caller
        const [now, kept] = await Promise.all([readGroup(db, userId, groupId), readEntry(db, id)]);
        if (!now) return c.json(NOT_FOUND, 404);
        if (kept && kept.groupId !== groupId) return c.json(ID_TAKEN, 409);
        return answerKept(now, kept);
    });

export { entriesRoutes };
