import { env } from 'cloudflare:workers';
import * as v from 'valibot';
import { beforeEach, describe, expect, it } from 'vitest';

import { sharedEntryInputSchema, type SharedEntryInput } from '@core/shared-entry';
import { readEntry, upsertEntry } from '@server/db/entries';
import { deleteGroup } from '@server/db/groups';
import { leaveGroup } from '@server/db/members';
import { claim, makeGroup, memberNamed } from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

import type { SharedGroup } from '@core/shared-group';

let ana: TestSession;
let bruno: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
});

function dinner(group: SharedGroup, updatedAt = 1_000) {
    return v.parse(sharedEntryInputSchema, {
        kind: 'expense',
        text: 'Dinner',
        categoryId: 'food',
        amountCents: 3000,
        currency: 'EUR',
        date: '2026-10-25',
        paidBy: group.me,
        split: 'equal',
        shares: [{ memberId: group.me, cents: 3000 }],
        createdAt: 1_000,
        updatedAt,
        deletedAt: null,
    });
}

// The entry `as` writes to the group, under that id
function write(as: TestSession, groupId: string, id: string, input: SharedEntryInput) {
    return upsertEntry(env.DB, { groupId, id, userId: as.userId }, input);
}

async function count() {
    return (await env.DB.prepare('SELECT COUNT(*) AS n FROM shared_entries').first<{ n: number }>())?.n;
}

describe('upsertEntry', () => {
    it('writes nothing for a user who has never been in the group', async () => {
        const group = await makeGroup(ana);

        expect(await write(bruno, group.id, crypto.randomUUID(), dinner(group))).toBeNull();
        expect(await count()).toBe(0);
    });

    it('writes nothing, new or newer, for a member who left or in a group that was deleted', async () => {
        const group = await makeGroup(ana, ['Bruno']);
        const brunoId = memberNamed(group, 'Bruno');
        await claim(brunoId, bruno);
        const id = crypto.randomUUID();
        const before = await write(ana, group.id, id, dinner(group));
        await leaveGroup(env.DB, brunoId);

        expect(await write(bruno, group.id, id, dinner(group, 2_000))).toBeNull();
        expect(await write(bruno, group.id, crypto.randomUUID(), dinner(group))).toBeNull();

        await deleteGroup(env.DB, group.id);

        expect(await write(ana, group.id, id, dinner(group, 3_000))).toBeNull();
        expect(await write(ana, group.id, crypto.randomUUID(), dinner(group))).toBeNull();
        expect((await readEntry(env.DB, id))?.entry).toEqual(before);
        expect(await count()).toBe(1);
    });

    it('never changes an entry of another group, however new the write', async () => {
        const group = await makeGroup(ana);
        const other = await makeGroup(ana);
        const id = crypto.randomUUID();
        const before = await write(ana, group.id, id, dinner(group));

        expect(await write(ana, other.id, id, dinner(other, 9_000))).toBeNull();
        expect(await readEntry(env.DB, id)).toEqual({ groupId: group.id, seq: 1, entry: before });
    });
});
