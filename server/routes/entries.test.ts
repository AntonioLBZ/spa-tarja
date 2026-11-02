import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_AMOUNT_CENTS } from '@core/money';
import { app } from '@server/app';
import { claim, groupOf, makeGroup, memberNamed, seedEntry, send } from '@server/test/groups';
import { signIn, type TestSession } from '@server/test/session';

import type { LedgerEntry } from '@core/shared-entry';
import type { SharedGroup } from '@core/shared-group';

let ana: TestSession;
let bruno: TestSession;
let carla: TestSession;

beforeEach(async () => {
    ana = await signIn('ana@example.com', 'Ana García');
    bruno = await signIn('bruno@example.com', 'Bruno Díaz');
    carla = await signIn('carla@example.com', 'Carla Ruiz');
});

// A group of Ana's in which Bruno is a member who is a user, with these dummies
async function tripWithBruno(dummies: string[] = []) {
    const group = await makeGroup(ana, ['Bruno', ...dummies]);
    const brunoId = memberNamed(group, 'Bruno');
    await claim(brunoId, bruno);
    return { group, bruno: brunoId };
}

function dinner(paidBy: string, shares: Record<string, number>, overrides: Record<string, unknown> = {}) {
    const list = Object.entries(shares).map(([memberId, cents]) => ({ memberId, cents }));
    return {
        kind: 'expense',
        text: 'Dinner',
        categoryId: 'food',
        amountCents: list.reduce((sum, share) => sum + share.cents, 0),
        currency: 'EUR',
        date: '2026-10-25',
        paidBy,
        split: 'exact',
        shares: list,
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

function settlement(paidBy: string, to: string, cents: number, overrides: Record<string, unknown> = {}) {
    return {
        kind: 'settlement',
        text: '',
        amountCents: cents,
        currency: 'EUR',
        date: '2026-10-26',
        paidBy,
        shares: [{ memberId: to, cents }],
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

function putEntry(as: TestSession, groupId: string, id: string, body: unknown) {
    return send(as, 'PUT', `/groups/${groupId}/entries/${id}`, body);
}

async function entryOf(response: Response) {
    expect(response.status).toBe(200);
    return (await response.json()) as LedgerEntry;
}

async function error(response: Response, status: number) {
    expect(response.status).toBe(status);
    return ((await response.json()) as { error: string }).error;
}

async function stored(id: string) {
    return env.DB.prepare('SELECT group_id, text, updated_at, deleted_at, seq FROM shared_entries WHERE id = ?1')
        .bind(id)
        .first<{ group_id: string; text: string; updated_at: number; deleted_at: number | null; seq: number }>();
}

async function seqsOf(groupId: string) {
    const { results } = await env.DB.prepare('SELECT seq FROM shared_entries WHERE group_id = ?1 ORDER BY seq')
        .bind(groupId)
        .all<{ seq: number }>();
    return results.map((row) => row.seq);
}

function removeMember(as: TestSession, group: SharedGroup, memberId: string) {
    return send(as, 'DELETE', `/groups/${group.id}/members/${memberId}`);
}

function list(as: TestSession, groupId: string, query = '') {
    return send(as, 'GET', `/groups/${groupId}/entries${query}`);
}

async function changes(as: TestSession, groupId: string, query = '') {
    const response = await list(as, groupId, query);
    expect(response.status).toBe(200);
    return (await response.json()) as { entries: LedgerEntry[]; cursor: number; hasMore: boolean };
}

describe('PUT /api/groups/:groupId/entries/:id', () => {
    it('creates the entry and answers it, with whoever made it and wrote it last as their member', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [group.me]: 1500, [brunoId]: 1500 });

        const entry = await entryOf(await putEntry(ana, group.id, id, body));

        expect(entry).toEqual({
            id,
            ...body,
            payment: 'direct',
            chargeDate: null,
            createdBy: group.me,
            updatedBy: group.me,
        });
        expect(await seqsOf(group.id)).toEqual([1]);
    });

    it('lets any member edit an entry, and records who wrote it last', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        await entryOf(await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 })));

        const edited = await entryOf(
            await putEntry(
                bruno,
                group.id,
                id,
                dinner(group.me, { [brunoId]: 3000 }, { text: 'Tapas', updatedAt: 2_000 })
            )
        );

        expect(edited).toMatchObject({ text: 'Tapas', updatedAt: 2_000, createdBy: group.me, updatedBy: brunoId });
        expect(await seqsOf(group.id)).toEqual([2]);
    });

    it('stores a settlement and how the payer paid by card', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const card = dinner(
            group.me,
            { [group.me]: 1000, [brunoId]: 2000 },
            { payment: 'voucher', chargeDate: '2026-11-01' }
        );

        const paid = await entryOf(
            await putEntry(bruno, group.id, crypto.randomUUID(), settlement(brunoId, group.me, 2000))
        );
        const voucher = await entryOf(await putEntry(ana, group.id, crypto.randomUUID(), card));

        expect(paid).toMatchObject({ kind: 'settlement', categoryId: null, split: 'exact', payment: 'direct' });
        expect(voucher).toMatchObject({ payment: 'voucher', chargeDate: '2026-11-01' });
    });

    it('reads the ids in upper case as the same group, entry and members', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const body = dinner(group.me.toUpperCase(), { [brunoId.toUpperCase()]: 3000 });

        const first = await entryOf(await putEntry(ana, group.id.toUpperCase(), id.toUpperCase(), body));
        const again = await entryOf(await putEntry(ana, group.id, id, { ...body, text: 'Lunch', updatedAt: 2_000 }));

        expect(first).toMatchObject({ id, paidBy: group.me, shares: [{ memberId: brunoId, cents: 3000 }] });
        expect(again).toMatchObject({ id, text: 'Lunch' });
        expect(await seqsOf(group.id)).toEqual([2]);
    });

    it('is idempotent: the same write again answers the same and moves nothing', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [brunoId]: 3000 });
        const first = await entryOf(await putEntry(ana, group.id, id, body));

        const again = await entryOf(await putEntry(ana, group.id, id, body));

        expect(again).toEqual(first);
        expect(await seqsOf(group.id)).toEqual([1]);
    });

    it.each([
        ['older than it', 4_000],
        ['of the same moment', 5_000],
    ])('keeps the stored entry over a write %s, and answers it', async (_name, updatedAt) => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const newest = await entryOf(
            await putEntry(
                ana,
                group.id,
                id,
                dinner(group.me, { [brunoId]: 3000 }, { text: 'Newest', updatedAt: 5_000 })
            )
        );

        const response = await putEntry(
            bruno,
            group.id,
            id,
            dinner(group.me, { [brunoId]: 3000 }, { text: 'Stale', updatedAt })
        );

        expect(await entryOf(response)).toEqual(newest);
        expect(await stored(id)).toMatchObject({ text: 'Newest', seq: 1 });
    });

    it('stores a delete as a tombstone, and a later write takes it back', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [brunoId]: 3000 });
        await entryOf(await putEntry(ana, group.id, id, body));

        const deleted = await entryOf(
            await putEntry(bruno, group.id, id, { ...body, updatedAt: 2_000, deletedAt: 2_000 })
        );
        expect(deleted).toMatchObject({ deletedAt: 2_000, updatedBy: brunoId });
        expect(await stored(id)).toMatchObject({ deleted_at: 2_000, seq: 2 });

        const back = await entryOf(await putEntry(ana, group.id, id, { ...body, updatedAt: 3_000 }));
        expect(back).toMatchObject({ deletedAt: null, updatedBy: group.me });
        expect(await seqsOf(group.id)).toEqual([3]);
    });

    it('writes the row that the seeded entries of the tests stand for', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const shares = { [group.me]: 500, [brunoId]: 700 };
        await seedEntry(group.id, { paidBy: group.me, shares });
        await entryOf(await putEntry(ana, group.id, id, dinner(group.me, shares, { createdAt: 1, updatedAt: 1 })));

        const { results } = await env.DB.prepare(
            `SELECT kind, text, category_id, amount_cents, currency, date, paid_by, split, shares, payment, charge_date,
                created_at, updated_at, deleted_at
             FROM shared_entries WHERE group_id = ?1 ORDER BY seq`
        )
            .bind(group.id)
            .all();

        expect(results).toHaveLength(2);
        expect(results[1]).toEqual(results[0]);
    });

    it('never answers a user id or an email, and writes nothing to anybody’s own expenses', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 }, { updatedAt: 5_000 }));

        const answers = [
            await putEntry(bruno, group.id, id, dinner(group.me, { [brunoId]: 3000 }, { updatedAt: 6_000 })),
            await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 }, { updatedAt: 1_000 })),
        ];

        for (const response of answers) {
            const text = await response.text();
            for (const secret of [ana.userId, bruno.userId, 'ana@example.com', 'bruno@example.com']) {
                expect(text).not.toContain(secret);
            }
        }
        expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM expenses').first()).toEqual({ n: 0 });
    });

    it.each([
        ['shares that don’t add up to the amount', { amountCents: 2999 }],
        ['an amount past the maximum', { amountCents: MAX_AMOUNT_CENTS + 1 }],
        ['an amount as text', { amountCents: '3000' }],
        ['a moment past the safe integers', { updatedAt: 1e300 }],
        ['a negative moment', { createdAt: -1 }],
        ['a text over the limit', { text: 'x'.repeat(201) }],
        ['a day that does not exist', { date: '2026-02-30' }],
        ['a payer that is not an id', { paidBy: 'ana' }],
        ['a card with no charge date', { payment: 'credit' }],
        ['a charge before the day it was made', { payment: 'credit', chargeDate: '2026-10-24' }],
        ['an unknown kind', { kind: 'refund' }],
        ['no shares', { shares: [] }],
    ])('answers 400 for %s', async (_name, overrides) => {
        const { group, bruno: brunoId } = await tripWithBruno();

        const response = await putEntry(
            ana,
            group.id,
            crypto.randomUUID(),
            dinner(group.me, { [brunoId]: 3000 }, overrides)
        );

        expect(response.status).toBe(400);
        expect(await seqsOf(group.id)).toEqual([]);
    });

    it.each([
        ['two receivers', 'two'],
        ['a receiver who is the payer', 'self'],
    ])('answers 400 for a settlement with %s', async (_name, which) => {
        const { group, bruno: brunoId } = await tripWithBruno(['Carla']);
        const carlaId = memberNamed(group, 'Carla');
        const shares =
            which === 'two'
                ? [
                      { memberId: group.me, cents: 1000 },
                      { memberId: carlaId, cents: 1000 },
                  ]
                : [{ memberId: brunoId, cents: 2000 }];

        const response = await putEntry(
            bruno,
            group.id,
            crypto.randomUUID(),
            settlement(brunoId, group.me, 2000, { shares })
        );

        expect(response.status).toBe(400);
    });

    it('answers 400 for an id that is not a UUID', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();

        expect((await putEntry(ana, group.id, 'entry-1', dinner(group.me, { [brunoId]: 3000 }))).status).toBe(400);
    });

    it.each([
        ['a custom category', crypto.randomUUID()],
        ['a category that does not exist', 'trips'],
    ])('answers 400 unknown-category for %s', async (_name, categoryId) => {
        const { group, bruno: brunoId } = await tripWithBruno();

        const response = await putEntry(
            ana,
            group.id,
            crypto.randomUUID(),
            dinner(group.me, { [brunoId]: 3000 }, { categoryId })
        );

        expect(await error(response, 400)).toBe('unknown-category');
        expect(await seqsOf(group.id)).toEqual([]);
    });

    it('answers 422 currency-mismatch for a currency other than the group’s', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();

        const response = await putEntry(
            ana,
            group.id,
            crypto.randomUUID(),
            dinner(group.me, { [brunoId]: 3000 }, { currency: 'USD' })
        );

        expect(await error(response, 422)).toBe('currency-mismatch');
    });

    it('answers 422 unknown-member for a payer or a share the group doesn’t have', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const theirs = await makeGroup(carla, ['Dani']);
        const strangers = [crypto.randomUUID(), theirs.me, memberNamed(theirs, 'Dani')];

        for (const stranger of strangers) {
            const asPayer = await putEntry(ana, group.id, crypto.randomUUID(), dinner(stranger, { [brunoId]: 3000 }));
            const asShare = await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [stranger]: 3000 }));
            expect(await error(asPayer, 422)).toBe('unknown-member');
            expect(await error(asShare, 422)).toBe('unknown-member');
        }
        expect(await seqsOf(group.id)).toEqual([]);
    });

    it('answers 422 member-left for a new payer or share who has left', async () => {
        const { group } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        await groupOf(await removeMember(ana, group, dani));

        const asPayer = await putEntry(ana, group.id, crypto.randomUUID(), dinner(dani, { [group.me]: 3000 }));
        const asShare = await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [dani]: 3000 }));

        expect(await error(asPayer, 422)).toBe('member-left');
        expect(await error(asShare, 422)).toBe('member-left');
        expect(await seqsOf(group.id)).toEqual([]);
    });

    it('lets an entry go on naming a member who left after it named them, so a balance can land on them', async () => {
        const { group } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        const id = crypto.randomUUID();
        await entryOf(await putEntry(ana, group.id, id, dinner(group.me, { [dani]: 3000 })));
        await entryOf(await putEntry(ana, group.id, crypto.randomUUID(), settlement(dani, group.me, 3000)));
        await groupOf(await removeMember(ana, group, dani));

        const edited = await putEntry(
            ana,
            group.id,
            id,
            dinner(group.me, { [dani]: 2000, [group.me]: 1000 }, { updatedAt: 2_000 })
        );
        const repaid = await putEntry(ana, group.id, id, dinner(dani, { [group.me]: 3000 }, { updatedAt: 3_000 }));

        expect(await entryOf(edited)).toMatchObject({
            shares: [
                { memberId: dani, cents: 2000 },
                { memberId: group.me, cents: 1000 },
            ],
        });
        expect(await entryOf(repaid)).toMatchObject({ paidBy: dani });
    });

    it('reads a placeholder merged into a member as that member', async () => {
        const group = await makeGroup(ana, ['Bru', 'Bruno']);
        const dummy = memberNamed(group, 'Bru');
        const brunoId = memberNamed(group, 'Bruno');
        await claim(brunoId, bruno);
        await groupOf(await send(ana, 'POST', `/groups/${group.id}/members/${dummy}/merge`, { into: brunoId }));
        const id = crypto.randomUUID();

        const written = await putEntry(ana, group.id, id, dinner(group.me, { [dummy]: 3000 }));
        expect(await entryOf(written)).toMatchObject({ shares: [{ memberId: dummy, cents: 3000 }] });

        await entryOf(await putEntry(bruno, group.id, crypto.randomUUID(), settlement(brunoId, group.me, 3000)));
        await groupOf(await removeMember(bruno, group, brunoId));

        const again = await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, { [dummy]: 3000 }));
        const renamed = await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 }, { updatedAt: 2_000 }));
        expect(await error(again, 422)).toBe('member-left');
        expect(await entryOf(renamed)).toMatchObject({ shares: [{ memberId: brunoId, cents: 3000 }] });
    });

    it('answers 409 id-taken for an entry of another group, tells nothing of it and leaves it as it was', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const other = await makeGroup(ana, ['Dani']);
        const carlas = await makeGroup(carla, ['Dani']);
        const id = crypto.randomUUID();
        await entryOf(await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 }, { text: 'Secret' })));
        const write = (into: SharedGroup) =>
            dinner(into.me, { [memberNamed(into, 'Dani')]: 3000 }, { updatedAt: 9_000 });

        const responses = [
            await putEntry(ana, other.id, id, write(other)),
            await putEntry(carla, carlas.id, id, write(carlas)),
        ];

        for (const response of responses) {
            expect(response.status).toBe(409);
            expect(await response.json()).toEqual({ error: 'id-taken' });
        }
        expect(await stored(id)).toMatchObject({ group_id: group.id, text: 'Secret', updated_at: 1_000 });
        expect(await seqsOf(other.id)).toEqual([]);
        expect(await seqsOf(carlas.id)).toEqual([]);
    });
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
