import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import {
    changes,
    dinner,
    entryOf,
    error,
    list,
    putEntry,
    removeMember,
    seqsOf,
    settlement,
    stored,
} from '@server/testing/entries';
import { claim, groupOf, makeGroup, memberNamed, seedEntry, send } from '@server/testing/groups';
import { signIn, type TestSession } from '@server/testing/session';

let ana: TestSession;
let bruno: TestSession;
let carla: TestSession;

async function tripWithBruno(dummies: string[] = []) {
    const group = await makeGroup(ana, ['Bruno', ...dummies]);
    const brunoId = memberNamed(group, 'Bruno');
    await claim(brunoId, bruno);
    return { group, bruno: brunoId };
}

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
    carla = await signIn('carla@example.com', 'Carla Ruiz');
});

describe('GET /api/groups/:groupId/entries', () => {
    it('starts empty with a zero cursor', async () => {
        const { group } = await tripWithBruno();

        expect(await changes(bruno, group.id)).toEqual({ entries: [], cursor: 0, hasMore: false });
    });

    it('answers every member the entries as they were written, oldest first, with the cursor of the last', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const first = await entryOf(
            await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [brunoId]: 3000 }))
        );
        const second = await entryOf(
            await putEntry(bruno, group.id, crypto.randomUUID(), settlement(brunoId, group.me, 3000))
        );

        for (const as of [ana, bruno]) {
            expect(await changes(as, group.id)).toEqual({ entries: [first, second], cursor: 2, hasMore: false });
        }
    });

    it('pages through the changes with the cursor', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
        for (const id of ids) await entryOf(await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 })));

        const first = await changes(bruno, group.id, '?limit=2');
        const second = await changes(bruno, group.id, `?limit=2&after=${first.cursor}`);

        expect(first.entries.map((entry) => entry.id)).toEqual(ids.slice(0, 2));
        expect(first.hasMore).toBe(true);
        expect(second.entries.map((entry) => entry.id)).toEqual(ids.slice(2));
        expect(second.hasMore).toBe(false);
        expect(await changes(bruno, group.id, `?after=${second.cursor}`)).toEqual({
            entries: [],
            cursor: second.cursor,
            hasMore: false,
        });
    });

    it('moves an edit past the cursor, and a delete as a tombstone', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [brunoId]: 3000 });
        await entryOf(await putEntry(ana, group.id, id, body));
        const { cursor } = await changes(bruno, group.id);

        await entryOf(await putEntry(ana, group.id, id, { ...body, text: 'Tapas', updatedAt: 2_000 }));
        const edited = await changes(bruno, group.id, `?after=${cursor}`);
        await entryOf(await putEntry(ana, group.id, id, { ...body, updatedAt: 3_000, deletedAt: 3_000 }));
        const deleted = await changes(bruno, group.id, `?after=${edited.cursor}`);

        expect(edited.entries).toMatchObject([{ id, text: 'Tapas', deletedAt: null }]);
        expect(deleted.entries).toMatchObject([{ id, deletedAt: 3_000 }]);
        expect(deleted.cursor).toBeGreaterThan(edited.cursor);
        expect((await changes(bruno, group.id)).entries).toMatchObject([{ id, deletedAt: 3_000 }]);
    });

    it('answers only the entries of that group, also to a member of two', async () => {
        const first = await tripWithBruno();
        const second = await tripWithBruno();
        const ids = [];
        for (const { group, bruno: brunoId } of [first, second]) {
            const id = crypto.randomUUID();
            await entryOf(await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 })));
            ids.push(id);
        }

        expect((await changes(bruno, first.group.id)).entries.map((entry) => entry.id)).toEqual([ids[0]]);
        expect((await changes(bruno, second.group.id)).entries.map((entry) => entry.id)).toEqual([ids[1]]);
    });

    it('pages out writes made at the same moment once each, by a cursor of each group', async () => {
        const first = await tripWithBruno();
        const second = await tripWithBruno();
        const written = await Promise.all(
            Array.from({ length: 10 }, async (_, index) => {
                const { group, bruno: brunoId } = index < 6 ? first : second;
                const id = crypto.randomUUID();
                const as = index % 2 === 0 ? ana : bruno;
                await entryOf(await putEntry(as, group.id, id, dinner(group.me, { [brunoId]: 3000 })));
                return { groupId: group.id, id };
            })
        );

        for (const { group } of [first, second]) {
            const cursors = [];
            const ids = [];
            let page = await changes(ana, group.id, '?limit=1');
            while (page.entries.length > 0) {
                cursors.push(page.cursor);
                ids.push(...page.entries.map((entry) => entry.id));
                page = await changes(ana, group.id, `?limit=1&after=${page.cursor}`);
            }
            const mine = written.filter((entry) => entry.groupId === group.id).map((entry) => entry.id);
            expect(cursors).toEqual(mine.map((_, index) => index + 1));
            expect(ids.toSorted()).toEqual(mine.toSorted());
        }
    });

    it('lets a member who left read only up to the moment they left, never an entry edited after', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const edited = crypto.randomUUID();
        const body = dinner(group.me, { [group.me]: 3000 });
        await entryOf(await putEntry(ana, group.id, edited, body));
        const own = await entryOf(
            await putEntry(bruno, group.id, crypto.randomUUID(), dinner(brunoId, { [brunoId]: 3000 }))
        );
        await groupOf(await removeMember(bruno, group, brunoId));

        await entryOf(await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [group.me]: 1000 })));
        await entryOf(await putEntry(ana, group.id, edited, { ...body, text: 'After', updatedAt: 2_000 }));

        expect(await changes(bruno, group.id)).toEqual({ entries: [own], cursor: 2, hasMore: false });
        expect(await changes(bruno, group.id, '?after=2')).toEqual({ entries: [], cursor: 2, hasMore: false });
        expect((await changes(ana, group.id)).entries).toHaveLength(3);

        await groupOf(await send(ana, 'DELETE', `/groups/${group.id}`));

        expect(await changes(bruno, group.id)).toEqual({ entries: [own], cursor: 2, hasMore: false });
    });

    it('gives a member who left before anything was written nothing of what came after, read or sent again', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await groupOf(await removeMember(bruno, group, brunoId));
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [group.me]: 3000 });
        await entryOf(await putEntry(ana, group.id, id, body));

        expect(await changes(bruno, group.id)).toEqual({ entries: [], cursor: 0, hasMore: false });
        expect(await error(await putEntry(bruno, group.id, id, body), 409)).toBe('closed');
    });

    it('lets the members of a deleted group read all of it', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const entries = [
            await entryOf(await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [group.me]: 3000 }))),
            await entryOf(await putEntry(bruno, group.id, crypto.randomUUID(), dinner(brunoId, { [brunoId]: 3000 }))),
        ];

        await groupOf(await send(ana, 'DELETE', `/groups/${group.id}`));

        for (const as of [ana, bruno]) {
            expect(await changes(as, group.id)).toEqual({ entries, cursor: 2, hasMore: false });
        }
    });

    it('names nobody as the writer once their account is deleted', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        await entryOf(await putEntry(bruno, group.id, id, dinner(brunoId, { [group.me]: 3000 })));

        await env.DB.prepare('DELETE FROM "user" WHERE id = ?1').bind(bruno.userId).run();

        expect((await changes(ana, group.id)).entries).toMatchObject([{ id, createdBy: null, updatedBy: null }]);
    });

    it('answers 200 entries a page unless asked otherwise', async () => {
        const { group } = await tripWithBruno();
        await Promise.all(
            Array.from({ length: 201 }, () => seedEntry(group.id, { paidBy: group.me, shares: { [group.me]: 100 } }))
        );

        const first = await changes(ana, group.id);
        const second = await changes(ana, group.id, `?after=${first.cursor}`);

        expect(first).toMatchObject({ cursor: 200, hasMore: true });
        expect(first.entries).toHaveLength(200);
        expect(second).toMatchObject({ cursor: 201, hasMore: false });
        expect(second.entries).toHaveLength(1);
    });

    it('never answers a user id or an email', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await entryOf(await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [brunoId]: 3000 })));
        await entryOf(await putEntry(bruno, group.id, crypto.randomUUID(), settlement(brunoId, group.me, 3000)));

        const text = await (await list(ana, group.id)).text();

        for (const secret of [ana.userId, bruno.userId, 'ana@example.com', 'bruno@example.com']) {
            expect(text).not.toContain(secret);
        }
    });

    it.each([
        ['?after=-1'],
        ['?after=abc'],
        ['?after=99999999999999999999'],
        ['?limit=0'],
        ['?limit=501'],
        ['?limit=1.5'],
    ])('answers 400 for %s', async (query) => {
        const { group } = await tripWithBruno();

        expect((await list(ana, group.id, query)).status).toBe(400);
    });

    it('answers 400 for a group id that is not a UUID', async () => {
        expect((await list(ana, 'trip')).status).toBe(400);
    });
});

describe('writes at the same moment', () => {
    it('land the same write once, and answer each the entry', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [brunoId]: 3000 });

        const responses = await Promise.all([1, 2, 3].map(() => putEntry(ana, group.id, id, body)));

        const entries = await Promise.all(responses.map(entryOf));
        for (const entry of entries) expect(entry).toEqual(entries[0]);
        expect(await seqsOf(group.id)).toEqual([1]);
    });

    it('each take the next seq of their own group, never one another write has', async () => {
        const first = await tripWithBruno();
        const second = await tripWithBruno();
        const writes = Array.from({ length: 12 }, (_, index) => {
            const { group, bruno: brunoId } = index % 3 === 0 ? second : first;
            const as = index % 2 === 0 ? ana : bruno;
            return putEntry(as, group.id, crypto.randomUUID(), dinner(group.me, { [brunoId]: 100 + index }));
        });

        for (const response of await Promise.all(writes)) expect(response.status).toBe(200);

        expect(await seqsOf(first.group.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(await seqsOf(second.group.id)).toEqual([1, 2, 3, 4]);
    });

    it('of the same new id to two groups land in one, and the other answers id-taken', async () => {
        const first = await tripWithBruno();
        const second = await tripWithBruno();
        const id = crypto.randomUUID();

        const responses = await Promise.all(
            [first, second].map(({ group, bruno: brunoId }) =>
                putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 }))
            )
        );

        expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
        const landed = await stored(id);
        expect([first.group.id, second.group.id]).toContain(landed?.group_id);
        expect([...(await seqsOf(first.group.id)), ...(await seqsOf(second.group.id))]).toEqual([1]);
    });
});

describe('a closed group', () => {
    it('takes no entry once it is deleted, before any other check', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        await entryOf(await putEntry(ana, group.id, id, dinner(group.me, { [group.me]: 3000 })));
        await groupOf(await send(ana, 'DELETE', `/groups/${group.id}`));

        const writes = [
            putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [brunoId]: 3000 })),
            putEntry(bruno, group.id, id, dinner(group.me, { [group.me]: 3000 }, { text: 'Edited', updatedAt: 2_000 })),
            putEntry(ana, group.id, id, dinner(group.me, { [group.me]: 3000 }, { updatedAt: 2_000, deletedAt: 2_000 })),
            putEntry(ana, group.id, id, dinner(group.me, { [group.me]: 3000 }, { text: 'Stale', updatedAt: 500 })),
            putEntry(
                ana,
                group.id,
                crypto.randomUUID(),
                dinner(group.me, { [brunoId]: 3000 }, { categoryId: 'trips' })
            ),
            putEntry(ana, group.id, crypto.randomUUID(), dinner(crypto.randomUUID(), { [brunoId]: 3000 })),
            putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [brunoId]: 3000 }, { currency: 'USD' })),
            putEntry(ana, group.id, id, dinner(group.me, { [group.me]: 3000 }, { updatedAt: Number.MAX_SAFE_INTEGER })),
        ];

        for (const response of await Promise.all(writes)) expect(await error(response, 409)).toBe('closed');
        expect(await stored(id)).toMatchObject({ text: 'Dinner', deleted_at: null, seq: 1 });
        expect(await seqsOf(group.id)).toEqual([1]);
    });

    it('takes no entry from a member who left it, before any other check', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await groupOf(await removeMember(bruno, group, brunoId));

        const writes = [
            putEntry(bruno, group.id, crypto.randomUUID(), dinner(brunoId, { [brunoId]: 3000 })),
            putEntry(
                bruno,
                group.id,
                crypto.randomUUID(),
                dinner(group.me, { [group.me]: 3000 }, { categoryId: 'trips' })
            ),
            putEntry(bruno, group.id, crypto.randomUUID(), dinner(crypto.randomUUID(), { [group.me]: 3000 })),
        ];

        for (const response of await Promise.all(writes)) expect(await error(response, 409)).toBe('closed');
        expect(await seqsOf(group.id)).toEqual([]);
    });

    it('answers the entry to the same write sent again once it landed, and nothing else', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const own = dinner(brunoId, { [brunoId]: 3000 });
        const landed = await entryOf(await putEntry(bruno, group.id, id, own));
        await groupOf(await removeMember(bruno, group, brunoId));

        expect(await entryOf(await putEntry(bruno, group.id, id, own))).toEqual(landed);
        expect(await error(await putEntry(bruno, group.id, id, { ...own, updatedAt: 2_000 }), 409)).toBe('closed');

        await groupOf(await send(ana, 'DELETE', `/groups/${group.id}`));
        expect(await entryOf(await putEntry(ana, group.id, id, own))).toEqual(landed);
        expect(await error(await putEntry(ana, group.id, id, { ...own, updatedAt: 2_000 }), 409)).toBe('closed');
    });

    it('answers a member who left nothing written after they left, even sent again', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const own = dinner(brunoId, { [brunoId]: 3000 });
        await entryOf(await putEntry(bruno, group.id, id, own));
        await groupOf(await removeMember(bruno, group, brunoId));
        await entryOf(await putEntry(ana, group.id, id, { ...own, text: 'After', updatedAt: 2_000 }));

        const response = await putEntry(bruno, group.id, id, { ...own, text: 'After', updatedAt: 2_000 });

        expect(await error(response, 409)).toBe('closed');
    });
});

describe('a stranger', () => {
    it('gets the same 404 for the entries of a group of somebody else as for one that does not exist', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        await entryOf(await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [brunoId]: 3000 })));

        for (const query of ['', '?after=0&limit=10']) {
            const theirs = await list(carla, group.id, query);
            const missing = await list(carla, crypto.randomUUID(), query);
            expect(theirs.status).toBe(404);
            expect(await theirs.text()).toBe(await missing.text());
        }
    });

    it('gets the same 404 for a group of somebody else as for one that does not exist, and writes nothing', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        await entryOf(await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 })));

        for (const [entryId, body] of [
            [crypto.randomUUID(), dinner(group.me, { [brunoId]: 3000 })],
            [id, dinner(group.me, { [brunoId]: 3000 }, { text: 'Mine now', updatedAt: 9_000 })],
            [id, dinner(group.me, { [brunoId]: 3000 }, { categoryId: 'trips' })],
        ] as const) {
            const theirs = await putEntry(carla, group.id, entryId, body);
            const missing = await putEntry(carla, crypto.randomUUID(), entryId, body);
            expect(theirs.status).toBe(404);
            expect(await theirs.text()).toBe(await missing.text());
        }
        expect(await stored(id)).toMatchObject({ text: 'Dinner', seq: 1 });
        expect(await seqsOf(group.id)).toEqual([1]);
    });

    it('gets 401 without a session, to a read and to a write', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const init = {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(dinner(group.me, { [brunoId]: 3000 })),
        };

        expect((await app.request(`/api/groups/${group.id}/entries`, {}, env)).status).toBe(401);
        expect((await app.request(`/api/groups/${group.id}/entries/${crypto.randomUUID()}`, init, env)).status).toBe(
            401
        );
    });
});
