import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { app } from '@server/app';
import { signIn, type TestSession } from '@server/test/session';

interface IncomeBody {
    month: string;
    amountCents: number;
    currency: string;
}

let session: TestSession;

beforeEach(async () => {
    session = await signIn();
});

function put(month: string, body: unknown) {
    const headers = new Headers(session.headers);
    headers.set('content-type', 'application/json');
    return app.request(`/api/income/${month}`, { method: 'PUT', headers, body: JSON.stringify(body) }, env);
}

function remove(month: string) {
    return app.request(`/api/income/${month}`, { method: 'DELETE', headers: session.headers }, env);
}

async function list() {
    const response = await app.request('/api/income', { headers: session.headers }, env);
    expect(response.status).toBe(200);
    return ((await response.json()) as { income: IncomeBody[] }).income;
}

async function insertForeign(month: string, amountCents: number) {
    await env.DB.prepare(
        `INSERT INTO income (user_id, month, amount_cents, currency, updated_at) VALUES ('someone-else', ?1, ?2, 'EUR', 1)`
    )
        .bind(month, amountCents)
        .run();
}

const salary = { amountCents: 200_000, currency: 'EUR' };

describe('GET /api/income', () => {
    it('starts empty', async () => {
        expect(await list()).toEqual([]);
    });

    it('lists the caller’s months, oldest first, and nobody else’s', async () => {
        await put('2026-11', { amountCents: 210_000, currency: 'EUR' });
        await put('2026-10', salary);
        await insertForeign('2026-10', 999);

        expect(await list()).toEqual([
            { month: '2026-10', amountCents: 200_000, currency: 'EUR' },
            { month: '2026-11', amountCents: 210_000, currency: 'EUR' },
        ]);
    });
});

describe('PUT /api/income/:month', () => {
    it('sets the income of the month and answers with it', async () => {
        const response = await put('2026-10', salary);

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ month: '2026-10', ...salary });
        expect(await list()).toEqual([{ month: '2026-10', ...salary }]);
    });

    it('is idempotent: repeating the same write changes nothing', async () => {
        await put('2026-10', salary);

        const again = await put('2026-10', salary);

        expect(again.status).toBe(200);
        expect(await list()).toEqual([{ month: '2026-10', ...salary }]);
    });

    it('replaces what the month had', async () => {
        await put('2026-10', salary);

        await put('2026-10', { amountCents: 250_000, currency: 'EUR' });

        expect(await list()).toEqual([{ month: '2026-10', amountCents: 250_000, currency: 'EUR' }]);
    });

    it('replaces the currency along with the amount', async () => {
        await put('2026-10', salary);

        await put('2026-10', { amountCents: 200_000, currency: 'USD' });

        expect(await list()).toEqual([{ month: '2026-10', amountCents: 200_000, currency: 'USD' }]);
    });

    it('keeps each month apart', async () => {
        await put('2026-10', salary);
        await put('2026-11', { amountCents: 1, currency: 'EUR' });

        expect(await list()).toHaveLength(2);
    });

    it('lets two users set the same month, and leaves the other’s alone', async () => {
        await insertForeign('2026-10', 999);

        await put('2026-10', salary);

        expect(await list()).toEqual([{ month: '2026-10', ...salary }]);
        const theirs = await env.DB.prepare(`SELECT amount_cents FROM income WHERE user_id = 'someone-else'`).first();
        expect(theirs).toEqual({ amount_cents: 999 });
    });

    it.each([
        ['a month that is not one', '2026-13', salary],
        ['a day instead of a month', '2026-10-01', salary],
        ['no amount', '2026-10', { currency: 'EUR' }],
        ['an amount of zero', '2026-10', { ...salary, amountCents: 0 }],
        ['an amount with decimals', '2026-10', { ...salary, amountCents: 10.5 }],
        ['a currency in lowercase', '2026-10', { ...salary, currency: 'eur' }],
    ])('rejects %s', async (_, month, body) => {
        const response = await put(month, body);

        expect(response.status).toBe(400);
        expect(await list()).toEqual([]);
    });
});

describe('DELETE /api/income/:month', () => {
    it('removes the income of the month', async () => {
        await put('2026-10', salary);
        await put('2026-11', salary);

        const response = await remove('2026-10');

        expect(response.status).toBe(204);
        expect(await list()).toEqual([{ month: '2026-11', ...salary }]);
    });

    it('answers 204 again for a month that has none', async () => {
        expect((await remove('2026-10')).status).toBe(204);
    });

    it('leaves other people’s income alone', async () => {
        await insertForeign('2026-10', 999);

        await remove('2026-10');

        const theirs = await env.DB.prepare(`SELECT COUNT(*) AS n FROM income WHERE user_id = 'someone-else'`).first();
        expect(theirs).toEqual({ n: 1 });
    });

    it('rejects a month that is not one', async () => {
        expect((await remove('october')).status).toBe(400);
    });
});
