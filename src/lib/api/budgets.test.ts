import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeApi } from '@/lib/test/fake-api';
import { stubApi } from '@/lib/test/render-app';

import { ApiError } from './api-error';
import { fetchBudgets, putBudgets } from './budgets';

import type { Budget } from '@core/budget';

const food: Budget = { month: '2026-10', scope: 'food', amountCents: 30_000, currency: 'EUR' };

function open(budgets: Budget[] = []) {
    const api = createFakeApi({ budgets });
    stubApi(api.handler);
    return api;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('fetchBudgets', () => {
    it('reads every row the server holds', async () => {
        open([food, { ...food, month: '2026-11', amountCents: 0 }]);

        expect(await fetchBudgets()).toEqual([food, { ...food, month: '2026-11', amountCents: 0 }]);
    });

    it('throws an ApiError with the status when the server refuses', async () => {
        const api = open();
        api.state.unauthorized = true;

        await expect(fetchBudgets()).rejects.toMatchObject({ status: 401 });
        await expect(fetchBudgets()).rejects.toBeInstanceOf(ApiError);
    });
});

describe('putBudgets', () => {
    it('sends the limits of the month in one request and answers with the rows it saved', async () => {
        const api = open();
        const input = {
            currency: 'EUR',
            limits: [
                { scope: 'total', amountCents: 90_000 },
                { scope: 'food', amountCents: 30_000 },
            ],
        };

        const saved = await putBudgets('2026-10', input);

        expect(api.budgetRequests).toEqual(['PUT 2026-10']);
        expect(api.budgetBodies).toEqual([input]);
        expect(saved).toEqual([{ month: '2026-10', scope: 'total', amountCents: 90_000, currency: 'EUR' }, food]);
    });

    it('replaces the row of a month and scope and keeps the others', async () => {
        const api = open([food, { ...food, scope: 'leisure', amountCents: 5_000 }]);

        await putBudgets('2026-10', { currency: 'EUR', limits: [{ scope: 'food', amountCents: 0 }] });

        expect(api.budgets).toEqual([
            { ...food, amountCents: 0 },
            { ...food, scope: 'leisure', amountCents: 5_000 },
        ]);
    });

    it('throws an ApiError with the status when the write fails', async () => {
        const api = open();
        api.state.budgetWriteStatus = 500;

        await expect(
            putBudgets('2026-10', { currency: 'EUR', limits: [{ scope: 'food', amountCents: 1 }] })
        ).rejects.toMatchObject({ status: 500 });
        expect(api.budgets).toEqual([]);
    });
});
