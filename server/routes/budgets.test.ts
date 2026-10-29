import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { signIn, type TestSession } from '@server/test/session';

interface BudgetBody {
    month: string;
    scope: string;
    amountCents: number;
    currency: string;
}

let session: TestSession;

beforeEach(async () => {
    session = await signIn();
});

function put(month: string, body: unknown, headers: Headers = session.headers) {
    const withType = new Headers(headers);
    withType.set('content-type', 'application/json');
    return app.request(`/api/budgets/${month}`, { method: 'PUT', headers: withType, body: JSON.stringify(body) }, env);
}

async function list() {
    const response = await app.request('/api/budgets', { headers: session.headers }, env);
    expect(response.status).toBe(200);
    return ((await response.json()) as { budgets: BudgetBody[] }).budgets;
}

async function insertForeign(month: string, scope: string, amountCents: number) {
    await env.DB.prepare(
        `INSERT INTO budget (user_id, month, scope, amount_cents, currency, updated_at) VALUES ('someone-else', ?1, ?2, ?3, 'EUR', 1)`
    )
        .bind(month, scope, amountCents)
        .run();
}

function limits(...entries: [string, number][]) {
    return { currency: 'EUR', limits: entries.map(([scope, amountCents]) => ({ scope, amountCents })) };
}

function row(month: string, scope: string, amountCents: number): BudgetBody {
    return { month, scope, amountCents, currency: 'EUR' };
}

describe('without a session', () => {
    it('answers 401 to a read and to a write', async () => {
        expect((await app.request('/api/budgets', {}, env)).status).toBe(401);
        const write = await app.request(
            '/api/budgets/2026-10',
            {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(limits(['total', 1])),
            },
            env
        );
        expect(write.status).toBe(401);
    });
});

describe('GET /api/budgets', () => {
    it('starts empty', async () => {
        expect(await list()).toEqual([]);
    });

    it('lists the caller’s rows by month and then scope, and nobody else’s', async () => {
        await put('2026-11', limits(['food', 100]));
        await put('2026-10', limits(['total', 900], ['food', 500]));
        await insertForeign('2026-10', 'food', 999);

        expect(await list()).toEqual([
            row('2026-10', 'food', 500),
            row('2026-10', 'total', 900),
            row('2026-11', 'food', 100),
        ]);
    });
});

describe('PUT /api/budgets/:month', () => {
    it('saves each limit and answers with the rows it saved', async () => {
        const category = crypto.randomUUID();

        const response = await put('2026-10', limits(['total', 90_000], ['food', 30_000], [category, 5_000]));

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            budgets: [row('2026-10', 'total', 90_000), row('2026-10', 'food', 30_000), row('2026-10', category, 5_000)],
        });
        expect(await list()).toHaveLength(3);
    });

    it('replaces the row of a month and scope instead of adding another', async () => {
        await put('2026-10', limits(['food', 30_000]));
        await put('2026-10', limits(['food', 40_000]));
        await put('2026-10', limits(['food', 50_000]));

        expect(await list()).toEqual([row('2026-10', 'food', 50_000)]);
    });

    it('leaves the scopes it was not given as they were', async () => {
        await put('2026-10', limits(['food', 30_000], ['total', 90_000]));
        await put('2026-10', limits(['food', 40_000]));

        expect(await list()).toEqual([row('2026-10', 'food', 40_000), row('2026-10', 'total', 90_000)]);
    });

    it('stores a 0, which is no limit, instead of deleting the row', async () => {
        await put('2026-09', limits(['food', 30_000]));
        await put('2026-10', limits(['food', 0]));

        expect(await list()).toEqual([row('2026-09', 'food', 30_000), row('2026-10', 'food', 0)]);
    });

    it('is idempotent: repeating a request changes nothing', async () => {
        const body = limits(['food', 30_000], ['total', 90_000]);
        await put('2026-10', body);
        const first = await list();

        await put('2026-10', body);

        expect(await list()).toEqual(first);
    });

    it.each([
        ['a month that is not one', '2026-13', limits(['food', 1])],
        ['a scope that is not one', '2026-10', limits(['food2', 1])],
        ['a scope given twice', '2026-10', limits(['food', 1], ['food', 2])],
        ['a negative amount', '2026-10', limits(['food', -1])],
        ['an amount with cents of a cent', '2026-10', limits(['food', 1.5])],
        ['no limits', '2026-10', limits()],
        ['a currency that is not one', '2026-10', { currency: 'eur', limits: [{ scope: 'food', amountCents: 1 }] }],
    ])('answers 400 to %s and writes nothing', async (_name, month, body) => {
        const response = await put(month, body);

        expect(response.status).toBe(400);
        expect(await list()).toEqual([]);
    });

    it('writes nothing at all when one of the limits is not valid', async () => {
        const response = await put('2026-10', limits(['food', 1], ['total', -5]));

        expect(response.status).toBe(400);
        expect(await list()).toEqual([]);
    });

    it('never touches the rows of another user', async () => {
        await insertForeign('2026-10', 'food', 999);

        await put('2026-10', limits(['food', 30_000]));

        const foreign = await env.DB.prepare(
            `SELECT amount_cents AS amountCents FROM budget WHERE user_id = 'someone-else'`
        ).all<{
            amountCents: number;
        }>();
        expect(foreign.results).toEqual([{ amountCents: 999 }]);
        expect(await list()).toEqual([row('2026-10', 'food', 30_000)]);
    });
});
