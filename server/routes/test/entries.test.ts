import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_AMOUNT_CENTS } from '@core/basics/money';
import { MAX_SHARES } from '@core/groups/shared-entry';
import { dinner, entryOf, error, putEntry, removeMember, seqsOf, settlement, stored } from '@server/testing/entries';
import { claim, groupOf, makeGroup, memberNamed, seedEntry, send } from '@server/testing/groups';
import { signIn, type TestSession } from '@server/testing/session';

import type { SharedGroup } from '@core/groups/shared-group';

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

    it('takes an equal split whose extra cent sits on any member, as the cents are drawn at random', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Dani']);
        const members = [group.me, brunoId, memberNamed(group, 'Dani')];

        for (const lucky of members) {
            const id = crypto.randomUUID();
            const shares = Object.fromEntries(members.map((memberId) => [memberId, memberId === lucky ? 334 : 333]));

            const entry = await entryOf(
                await putEntry(ana, group.id, id, dinner(group.me, shares, { split: 'equal' }))
            );

            expect(entry).toMatchObject({ amountCents: 1000, split: 'equal' });
            expect(entry.shares).toEqual(members.map((memberId) => ({ memberId, cents: shares[memberId] })));
        }
        expect(await seqsOf(group.id)).toEqual([1, 2, 3]);
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

    it('answers 422 not-the-payer to a card set for somebody else, and lets the payer add it', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        const id = crypto.randomUUID();
        const halves = { [group.me]: 1500, [brunoId]: 1500 };
        const credit = { payment: 'credit', chargeDate: '2026-11-25' };

        const forAna = await putEntry(bruno, group.id, id, dinner(group.me, halves, credit));
        const forDani = await putEntry(
            ana,
            group.id,
            crypto.randomUUID(),
            dinner(dani, { [dani]: 1500, [brunoId]: 1500 }, { payment: 'voucher', chargeDate: '2026-10-25' })
        );
        expect(await error(forAna, 422)).toBe('not-the-payer');
        expect(await error(forDani, 422)).toBe('not-the-payer');

        expect(await entryOf(await putEntry(bruno, group.id, id, dinner(group.me, halves)))).toMatchObject({
            payment: 'direct',
        });
        expect(
            await entryOf(await putEntry(ana, group.id, id, dinner(group.me, halves, { ...credit, updatedAt: 2_000 })))
        ).toMatchObject(credit);
    });

    it('lets another member edit an expense around the payer’s card, but not change it or give it to somebody else', async () => {
        const { group, bruno: brunoId } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        const id = crypto.randomUUID();
        const halves = { [group.me]: 1500, [brunoId]: 1500 };
        const credit = { payment: 'credit', chargeDate: '2026-11-25' };
        await entryOf(await putEntry(ana, group.id, id, dinner(group.me, halves, credit)));

        const redated = await putEntry(
            bruno,
            group.id,
            id,
            dinner(group.me, halves, { ...credit, chargeDate: '2026-12-25', updatedAt: 2_000 })
        );
        const voucher = await putEntry(
            bruno,
            group.id,
            id,
            dinner(group.me, halves, { ...credit, payment: 'voucher', updatedAt: 2_000 })
        );
        const handed = await putEntry(
            bruno,
            group.id,
            id,
            dinner(dani, { [dani]: 1500, [brunoId]: 1500 }, { ...credit, updatedAt: 2_000 })
        );
        const reworded = await putEntry(
            bruno,
            group.id,
            id,
            dinner(group.me, halves, { ...credit, text: 'Tapas', updatedAt: 3_000 })
        );

        expect(await error(redated, 422)).toBe('not-the-payer');
        expect(await error(voucher, 422)).toBe('not-the-payer');
        expect(await error(handed, 422)).toBe('not-the-payer');
        expect(await entryOf(reworded)).toMatchObject({ ...credit, text: 'Tapas', updatedBy: brunoId });
    });

    it('answers 422 kind-fixed to an expense turned into a settlement, or the reverse, deleted or not', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const expense = crypto.randomUUID();
        const payment = crypto.randomUUID();
        await entryOf(await putEntry(ana, group.id, expense, dinner(group.me, { [brunoId]: 3000 })));
        await entryOf(
            await putEntry(bruno, group.id, payment, settlement(brunoId, group.me, 3000, { deletedAt: 1_000 }))
        );

        const writes = [
            putEntry(ana, group.id, expense, settlement(group.me, brunoId, 3000, { updatedAt: 2_000 })),
            putEntry(bruno, group.id, payment, dinner(brunoId, { [group.me]: 3000 }, { updatedAt: 2_000 })),
        ];

        for (const response of await Promise.all(writes)) expect(await error(response, 422)).toBe('kind-fixed');
        expect(await seqsOf(group.id)).toEqual([1, 2]);
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

    it(`answers 400 for more than ${MAX_SHARES} shares`, async () => {
        const { group } = await tripWithBruno();
        const shares = Object.fromEntries(Array.from({ length: MAX_SHARES + 1 }, () => [crypto.randomUUID(), 1]));

        const response = await putEntry(ana, group.id, crypto.randomUUID(), dinner(group.me, shares));

        expect(response.status).toBe(400);
        expect(await response.text()).not.toContain('unknown-member');
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

    it.each(['personal', 'treats', 'gifts'])('takes the default category %s', async (categoryId) => {
        const { group, bruno: brunoId } = await tripWithBruno();

        const response = await putEntry(
            ana,
            group.id,
            crypto.randomUUID(),
            dinner(group.me, { [brunoId]: 3000 }, { categoryId })
        );

        expect(await entryOf(response)).toMatchObject({ categoryId });
    });

    it('answers unknown-category before currency-mismatch', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const body = dinner(group.me, { [brunoId]: 3000 }, { categoryId: 'trips', currency: 'USD' });

        expect(await error(await putEntry(ana, group.id, crypto.randomUUID(), body), 400)).toBe('unknown-category');
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

    it('answers 422 clock-ahead for a write from a clock more than a day ahead, and keeps the entry editable', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [brunoId]: 3000 });
        await entryOf(await putEntry(ana, group.id, id, body));
        const day = 86_400_000;

        for (const updatedAt of [Date.now() + 2 * day, Number.MAX_SAFE_INTEGER]) {
            const ahead = await putEntry(bruno, group.id, id, { ...body, updatedAt, deletedAt: updatedAt });
            const created = await putEntry(bruno, group.id, crypto.randomUUID(), { ...body, updatedAt });
            expect(await error(ahead, 422)).toBe('clock-ahead');
            expect(await error(created, 422)).toBe('clock-ahead');
        }
        const soon = await putEntry(ana, group.id, id, { ...body, text: 'Tapas', updatedAt: Date.now() + day / 2 });
        expect(await entryOf(soon)).toMatchObject({ text: 'Tapas', deletedAt: null });
        expect(await seqsOf(group.id)).toEqual([2]);
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

    it('lets an entry that named a member who left change its text, day, category or card around them', async () => {
        const { group } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        const owed = crypto.randomUUID();
        const paid = crypto.randomUUID();
        const card = { split: 'equal', payment: 'credit', chargeDate: '2026-11-25' };
        const halves = { [group.me]: 1500, [dani]: 1500 };
        await entryOf(await putEntry(ana, group.id, owed, dinner(group.me, halves, card)));
        await entryOf(await putEntry(ana, group.id, paid, dinner(dani, halves)));
        await groupOf(await removeMember(ana, group, dani));

        const changes = { text: 'Tapas', date: '2026-10-26', categoryId: 'leisure', updatedAt: 2_000 };
        const edited = await putEntry(
            ana,
            group.id,
            owed,
            dinner(group.me, halves, { ...card, ...changes, chargeDate: '2026-12-25' })
        );
        const reworded = await putEntry(ana, group.id, paid, dinner(dani, halves, changes));

        expect(await entryOf(edited)).toMatchObject({ ...changes, chargeDate: '2026-12-25', paidBy: group.me });
        expect(await entryOf(reworded)).toMatchObject({ ...changes, paidBy: dani });
    });

    it('answers 422 member-left to an edit that moves what a member who left pays or owes', async () => {
        const { group } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        const owed = crypto.randomUUID();
        const paid = crypto.randomUUID();
        const halves = { [group.me]: 1500, [dani]: 1500 };
        await entryOf(await putEntry(ana, group.id, owed, dinner(group.me, halves, { split: 'equal' })));
        await entryOf(await putEntry(ana, group.id, paid, dinner(dani, halves)));
        await groupOf(await removeMember(ana, group, dani));
        const later = { split: 'equal', updatedAt: 2_000 };

        const edits = [
            putEntry(ana, group.id, owed, dinner(group.me, { [group.me]: 1000, [dani]: 2000 }, later)),
            putEntry(ana, group.id, owed, dinner(group.me, { [group.me]: 2000, [dani]: 2000 }, later)),
            putEntry(ana, group.id, owed, dinner(group.me, { [group.me]: 3000 }, later)),
            putEntry(ana, group.id, owed, dinner(dani, halves, later)),
            putEntry(ana, group.id, paid, dinner(dani, { [group.me]: 2500, [dani]: 1500 }, later)),
            putEntry(ana, group.id, paid, dinner(group.me, halves, later)),
        ];

        for (const response of await Promise.all(edits)) expect(await error(response, 422)).toBe('member-left');
        expect(await stored(owed)).toMatchObject({ updated_at: 1_000 });
        expect(await stored(paid)).toMatchObject({ updated_at: 1_000 });
    });

    it('lets an entry that named a member who left be deleted and brought back as it was', async () => {
        const { group } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [group.me]: 1500, [dani]: 1500 });
        await entryOf(await putEntry(ana, group.id, id, body));
        await entryOf(await putEntry(ana, group.id, crypto.randomUUID(), settlement(dani, group.me, 1500)));
        await groupOf(await removeMember(ana, group, dani));

        const deleted = await putEntry(ana, group.id, id, { ...body, updatedAt: 2_000, deletedAt: 2_000 });
        const back = await putEntry(ana, group.id, id, { ...body, updatedAt: 3_000 });

        expect(await entryOf(deleted)).toMatchObject({ deletedAt: 2_000 });
        expect(await entryOf(back)).toMatchObject({ deletedAt: null });
    });

    it('holds an entry deleted before a member left to what it said of them', async () => {
        const { group } = await tripWithBruno(['Dani']);
        const dani = memberNamed(group, 'Dani');
        const id = crypto.randomUUID();
        const body = dinner(group.me, { [group.me]: 1500, [dani]: 1500 });
        await entryOf(await putEntry(ana, group.id, id, body));
        await entryOf(await putEntry(ana, group.id, id, { ...body, updatedAt: 1_500, deletedAt: 1_500 }));
        await groupOf(await removeMember(ana, group, dani));

        const raised = await putEntry(
            ana,
            group.id,
            id,
            dinner(group.me, { [group.me]: 1000, [dani]: 2000 }, { updatedAt: 2_000 })
        );
        const back = await putEntry(ana, group.id, id, { ...body, updatedAt: 3_000 });

        expect(await error(raised, 422)).toBe('member-left');
        expect(await entryOf(back)).toMatchObject({ deletedAt: null, shares: body.shares });
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

    it('answers 409 id-taken before closed and before any check of the content', async () => {
        const { group, bruno: brunoId } = await tripWithBruno();
        const closed = await makeGroup(ana, ['Dani']);
        const id = crypto.randomUUID();
        await entryOf(await putEntry(ana, group.id, id, dinner(group.me, { [brunoId]: 3000 })));
        await groupOf(await send(ana, 'DELETE', `/groups/${closed.id}`));
        const open = await makeGroup(ana, ['Dani']);
        const dani = memberNamed(open, 'Dani');

        const writes = [
            putEntry(ana, closed.id, id, dinner(closed.me, { [memberNamed(closed, 'Dani')]: 3000 })),
            putEntry(ana, open.id, id, dinner(open.me, { [dani]: 3000 }, { categoryId: 'trips', currency: 'USD' })),
            putEntry(ana, open.id, id, dinner(crypto.randomUUID(), { [dani]: 3000 })),
            putEntry(ana, open.id, id, dinner(open.me, { [dani]: 3000 }, { updatedAt: Number.MAX_SAFE_INTEGER })),
            putEntry(ana, open.id, id, settlement(dani, open.me, 3000)),
        ];

        for (const response of await Promise.all(writes)) expect(await error(response, 409)).toBe('id-taken');
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
