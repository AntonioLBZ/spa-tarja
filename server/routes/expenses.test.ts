import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { signIn, type TestSession } from '@server/test/session';

interface Payload {
    categoryId: string;
    text: string;
    amountCents: number;
    currency: string;
    date: string;
    payment?: string;
    chargeDate?: string | null;
    personalCents?: number | null;
    plan?: { id: string; part: number; parts: number } | null;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
}

function payload(overrides: Partial<Payload> = {}): Payload {
    return {
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-10-25',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

let session: TestSession;

beforeEach(async () => {
    session = await signIn();
});

function put(id: string, body: unknown) {
    const headers = new Headers(session.headers);
    headers.set('content-type', 'application/json');
    return app.request(`/api/expenses/${id}`, { method: 'PUT', headers, body: JSON.stringify(body) }, env);
}

function list(query = '') {
    return app.request(`/api/expenses${query}`, { headers: session.headers }, env);
}

async function changes(query = '') {
    const response = await list(query);
    expect(response.status).toBe(200);
    return (await response.json()) as {
        expenses: Array<Payload & { id: string }>;
        cursor: number;
        hasMore: boolean;
    };
}

async function insertForeign(id: string) {
    await env.DB.prepare(
        `INSERT INTO expenses (id, user_id, category_id, text, amount_cents, currency, date, created_at, updated_at, deleted_at, seq)
         VALUES (?1, 'someone-else', 'food', 'Not yours', 500, 'EUR', '2026-10-25', 1, 1, NULL, 1)`
    )
        .bind(id)
        .run();
}

describe('PUT /api/expenses/:id', () => {
    it('creates the expense and answers with it', async () => {
        const id = crypto.randomUUID();

        const response = await put(id, payload());

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            id,
            ...payload(),
            payment: 'direct',
            chargeDate: null,
            personalCents: null,
            plan: null,
        });
    });

    it('stores when a deferred expense is charged and how it was paid', async () => {
        const id = crypto.randomUUID();

        const response = await put(id, payload({ payment: 'credit', chargeDate: '2026-11-05' }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ id, payment: 'credit', chargeDate: '2026-11-05' });
        expect((await changes()).expenses[0]).toMatchObject({ payment: 'credit', chargeDate: '2026-11-05' });
    });

    it('stores a restaurant card expense', async () => {
        const response = await put(crypto.randomUUID(), payload({ payment: 'voucher', chargeDate: '2026-11-01' }));

        expect(await response.json()).toMatchObject({ payment: 'voucher', chargeDate: '2026-11-01' });
    });

    it('stores your part of a restaurant card expense', async () => {
        const id = crypto.randomUUID();
        const dinner = payload({
            amountCents: 4000,
            personalCents: 2000,
            payment: 'voucher',
            chargeDate: '2026-11-12',
        });

        const response = await put(id, dinner);

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ id, amountCents: 4000, personalCents: 2000 });
        expect((await changes()).expenses[0]).toMatchObject({ amountCents: 4000, personalCents: 2000 });
    });

    it.each([0, 4000])('stores a part of %i cents, from nothing to all of it', async (personalCents) => {
        const response = await put(
            crypto.randomUUID(),
            payload({ amountCents: 4000, personalCents, payment: 'voucher', chargeDate: '2026-11-12' })
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ personalCents });
    });

    it('stores no part for a restaurant card expense from a client that does not send one', async () => {
        const response = await put(crypto.randomUUID(), payload({ payment: 'voucher', chargeDate: '2026-11-12' }));

        expect(await response.json()).toMatchObject({ payment: 'voucher', personalCents: null });
        expect((await changes()).expenses[0]).toMatchObject({ personalCents: null });
    });

    it('changes your part with a later write, and drops it when a later write has none', async () => {
        const id = crypto.randomUUID();
        const voucher = { amountCents: 4000, payment: 'voucher', chargeDate: '2026-11-12' };
        await put(id, payload({ ...voucher, personalCents: 2000 }));

        await put(id, payload({ ...voucher, personalCents: 1500, updatedAt: 2_000 }));
        expect((await changes()).expenses[0]).toMatchObject({ personalCents: 1500 });

        await put(id, payload({ ...voucher, updatedAt: 3_000 }));
        expect((await changes()).expenses[0]).toMatchObject({ personalCents: null });
    });

    it('keeps your part when the write is older', async () => {
        const id = crypto.randomUUID();
        const voucher = { amountCents: 4000, payment: 'voucher', chargeDate: '2026-11-12' };
        await put(id, payload({ ...voucher, personalCents: 2000, updatedAt: 5_000 }));

        const response = await put(id, payload({ ...voucher, personalCents: 1000, updatedAt: 3_000 }));

        expect(await response.json()).toMatchObject({ personalCents: 2000 });
    });

    it('moves an expense to another charge date, or back to being charged at once', async () => {
        const id = crypto.randomUUID();
        await put(id, payload({ payment: 'credit', chargeDate: '2026-11-05' }));

        await put(id, payload({ payment: 'credit', chargeDate: '2026-12-05', updatedAt: 2_000 }));
        expect((await changes()).expenses[0]).toMatchObject({ payment: 'credit', chargeDate: '2026-12-05' });

        await put(id, payload({ payment: 'direct', chargeDate: null, updatedAt: 3_000 }));
        expect((await changes()).expenses[0]).toMatchObject({ payment: 'direct', chargeDate: null });
    });

    it('stores the part of an installment plan that an expense is', async () => {
        const id = crypto.randomUUID();
        const plan = { id: crypto.randomUUID(), part: 2, parts: 3 };

        const response = await put(id, payload({ payment: 'direct', chargeDate: '2026-11-25', plan }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ id, plan });
        expect((await changes()).expenses[0]).toMatchObject({ plan });
    });

    it('keeps the parts of a plan as separate expenses, each with its own amount and day', async () => {
        const plan = crypto.randomUUID();
        const days = ['2026-10-25', '2026-11-25', '2026-12-25'];
        for (const [index, chargeDate] of days.entries()) {
            await put(
                crypto.randomUUID(),
                payload({ amountCents: 500 + index, chargeDate, plan: { id: plan, part: index + 1, parts: 3 } })
            );
        }

        const { expenses } = await changes();

        expect(expenses.map((expense) => [expense.plan?.part, expense.amountCents, expense.chargeDate])).toEqual([
            [1, 500, '2026-10-25'],
            [2, 501, '2026-11-25'],
            [3, 502, '2026-12-25'],
        ]);
    });

    it('takes a plan away when a later write has none', async () => {
        const id = crypto.randomUUID();
        await put(id, payload({ plan: { id: crypto.randomUUID(), part: 1, parts: 2 } }));

        await put(id, payload({ plan: null, updatedAt: 2_000 }));

        expect((await changes()).expenses[0]).toMatchObject({ plan: null });
    });

    it('reads an expense saved before payments existed as paid at once', async () => {
        const id = crypto.randomUUID();
        await env.DB.prepare(
            `INSERT INTO expenses (id, user_id, category_id, text, amount_cents, currency, date, created_at, updated_at, deleted_at, seq)
             VALUES (?1, ?2, 'food', 'Old', 500, 'EUR', '2026-10-25', 1, 1, NULL, 1)`
        )
            .bind(id, session.userId)
            .run();

        expect((await changes()).expenses[0]).toMatchObject({
            id,
            payment: 'direct',
            chargeDate: null,
            personalCents: null,
            plan: null,
        });
    });

    it('is idempotent: repeating the same write changes nothing', async () => {
        const id = crypto.randomUUID();
        await put(id, payload());
        const first = await changes();

        await put(id, payload());
        const second = await changes();

        expect(second.expenses).toEqual(first.expenses);
        expect(second.cursor).toBe(first.cursor);
    });

    it('applies a newer edit and moves it past the cursor', async () => {
        const id = crypto.randomUUID();
        await put(id, payload());
        const { cursor } = await changes();

        const response = await put(id, payload({ text: 'Dinner', updatedAt: 2_000 }));

        expect(response.status).toBe(200);
        const after = await changes(`?after=${cursor}`);
        expect(after.expenses).toHaveLength(1);
        expect(after.expenses[0]).toMatchObject({ id, text: 'Dinner', updatedAt: 2_000 });
        expect(after.cursor).toBeGreaterThan(cursor);
    });

    it('keeps the stored expense when the write is older, and answers with the stored one', async () => {
        const id = crypto.randomUUID();
        await put(id, payload({ text: 'Newest', updatedAt: 5_000 }));

        const response = await put(id, payload({ text: 'Stale', updatedAt: 3_000 }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ id, text: 'Newest', updatedAt: 5_000 });
        expect((await changes()).expenses[0]).toMatchObject({ text: 'Newest' });
    });

    it('stores a delete as a tombstone that the cursor still sees', async () => {
        const id = crypto.randomUUID();
        await put(id, payload());
        const { cursor } = await changes();

        await put(id, payload({ updatedAt: 2_000, deletedAt: 2_000 }));

        const after = await changes(`?after=${cursor}`);
        expect(after.expenses).toHaveLength(1);
        expect(after.expenses[0]).toMatchObject({ id, deletedAt: 2_000 });
    });

    it('rejects an id that belongs to another user and leaves it untouched', async () => {
        const id = crypto.randomUUID();
        await insertForeign(id);

        const response = await put(id, payload({ text: 'Mine now', updatedAt: 9_999 }));

        expect(response.status).toBe(409);
        const row = await env.DB.prepare('SELECT user_id, text FROM expenses WHERE id = ?1').bind(id).first();
        expect(row).toEqual({ user_id: 'someone-else', text: 'Not yours' });
    });

    it.each([
        ['a non-positive amount', { amountCents: 0 }],
        ['a fractional amount', { amountCents: 12.5 }],
        ['an amount beyond what is stored safely', { amountCents: 1e12 }],
        ['a malformed date', { date: '25/10/2026' }],
        ['a date that does not exist', { date: '2026-02-30' }],
        ['a lowercase currency', { currency: 'eur' }],
        ['an unknown category', { categoryId: 'nope' }],
        ['text over the limit', { text: 'x'.repeat(201) }],
        ['a negative timestamp', { updatedAt: -1 }],
        ['an unknown payment', { payment: 'cash' }],
        ['a credit card expense with no charge date', { payment: 'credit' }],
        ['a restaurant card expense with no charge date', { payment: 'voucher', chargeDate: null }],
        ['a charge date before the expense', { payment: 'credit', chargeDate: '2026-10-24' }],
        ['a charge date that does not exist', { payment: 'credit', chargeDate: '2026-11-31' }],
        ['a part past the last one', { plan: { id: crypto.randomUUID(), part: 4, parts: 3 } }],
        ['a plan of one part', { plan: { id: crypto.randomUUID(), part: 1, parts: 1 } }],
        ['a plan with an id that is not a UUID', { plan: { id: 'plan', part: 1, parts: 2 } }],
        [
            'a part over the total',
            { amountCents: 4000, personalCents: 4001, payment: 'voucher', chargeDate: '2026-11-25' },
        ],
        ['a negative part', { personalCents: -1, payment: 'voucher', chargeDate: '2026-11-25' }],
        ['a fractional part', { personalCents: 10.5, payment: 'voucher', chargeDate: '2026-11-25' }],
        ['a part of a credit card expense', { personalCents: 500, payment: 'credit', chargeDate: '2026-11-25' }],
        ['a part of an expense paid at once', { personalCents: 500, payment: 'direct' }],
        ['a part of an expense that says nothing about its payment', { personalCents: 500 }],
        [
            'a restaurant card in installments',
            { payment: 'voucher', chargeDate: '2026-11-25', plan: { id: crypto.randomUUID(), part: 1, parts: 2 } },
        ],
    ])('answers 400 for %s', async (_name, overrides) => {
        const response = await put(crypto.randomUUID(), payload(overrides));

        expect(response.status).toBe(400);
    });

    it('accepts a UUID as the category even when no such category exists', async () => {
        const categoryId = crypto.randomUUID();

        const response = await put(crypto.randomUUID(), payload({ categoryId }));

        expect(response.status).toBe(200);
        expect(((await response.json()) as Payload).categoryId).toBe(categoryId);
    });

    it('answers 400 when the id is not a UUID', async () => {
        const response = await put('not-a-uuid', payload());

        expect(response.status).toBe(400);
    });

    it('answers 400 when the body is missing fields', async () => {
        const response = await put(crypto.randomUUID(), { text: 'Only text' });

        expect(response.status).toBe(400);
    });
});

describe('GET /api/expenses', () => {
    it('starts empty with a zero cursor', async () => {
        expect(await changes()).toEqual({ expenses: [], cursor: 0, hasMore: false });
    });

    it('returns only the caller expenses', async () => {
        await insertForeign(crypto.randomUUID());
        const id = crypto.randomUUID();
        await put(id, payload());

        const { expenses } = await changes();

        expect(expenses.map((expense) => expense.id)).toEqual([id]);
    });

    it('pages through the changes with the cursor', async () => {
        const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
        for (const id of ids) await put(id, payload());

        const first = await changes('?limit=2');
        const second = await changes(`?limit=2&after=${first.cursor}`);

        expect(first.expenses.map((expense) => expense.id)).toEqual(ids.slice(0, 2));
        expect(first.hasMore).toBe(true);
        expect(second.expenses.map((expense) => expense.id)).toEqual(ids.slice(2));
        expect(second.hasMore).toBe(false);
        expect(second.cursor).toBeGreaterThan(first.cursor);
    });

    it('keeps the cursor where it was when nothing changed', async () => {
        await put(crypto.randomUUID(), payload());
        const { cursor } = await changes();

        expect(await changes(`?after=${cursor}`)).toEqual({ expenses: [], cursor, hasMore: false });
    });

    it('does not hand out the user id', async () => {
        await put(crypto.randomUUID(), payload());

        const { expenses } = await changes();

        expect(JSON.stringify(expenses)).not.toContain(session.userId);
        expect(Object.keys(expenses[0] ?? {})).not.toContain('userId');
    });

    it.each([['?after=-1'], ['?after=abc'], ['?limit=0'], ['?limit=501'], ['?limit=1.5']])(
        'answers 400 for %s',
        async (query) => {
            expect((await list(query)).status).toBe(400);
        }
    );
});
