import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { BUDGETS_KEY, EXPENSES_KEY, INCOME_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { Budget } from '@core/budget';
import type { Category } from '@core/category';
import type { Expense } from '@core/expense';

const GYM: Category = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' };

function expense(overrides: Partial<Expense> = {}): Expense {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1000,
        currency: 'EUR',
        date: '2026-10-24',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
}

function limit(month: string, scope: string, amountCents: number): Budget {
    return { month, scope, amountCents, currency: 'EUR' };
}

async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi({ categories: [GYM], ...options });
    stubApi(api.handler);
    const app = renderApp({ path: '/summary' });
    await screen.findByRole('heading', { name: en.summary.title });
    await waitFor(() => {
        expect(app.queryClient.getQueryState(EXPENSES_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(INCOME_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(BUDGETS_KEY)?.status).toBe('success');
    });
    return { api, app };
}

function bars() {
    return screen.queryByRole('list', { name: en.budgets.title });
}

function items() {
    return within(bars()!).getAllByRole('listitem');
}

function itemOf(name: string) {
    const found = items().find((item) => item.textContent?.includes(name));
    if (!found) throw new Error(`No bar for ${name}`);
    return found;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('the bars of the limits in the summary', () => {
    it('are not there while the month holds no limit', async () => {
        await open({ expenses: [expense()] });

        expect(bars()).toBeNull();
    });

    it('have the total first and then each category with a limit, in the order of the list', async () => {
        await open({
            budgets: [
                limit('2026-10', 'leisure', 5_000),
                limit('2026-10', 'total', 90_000),
                limit('2026-10', 'food', 30_000),
                limit('2026-10', GYM.id, 1_000),
            ],
        });

        expect(items().map((item) => item.textContent)).toEqual([
            expect.stringContaining(en.budgets.total),
            expect.stringContaining(en.categories.food),
            expect.stringContaining(en.categories.leisure),
            expect.stringContaining('Gym'),
        ]);
    });

    it('say what was spent of the limit and the use as a whole percentage', async () => {
        await open({
            expenses: [expense({ amountCents: 12_000 })],
            budgets: [limit('2026-10', 'food', 30_000)],
        });

        const item = itemOf(en.categories.food);
        expect(item.textContent).toContain('€120.00 of €300.00');
        expect(item.textContent).toContain('40 %');
    });

    it('are not marked as over when near, and say by how much when over', async () => {
        await open({
            expenses: [expense({ amountCents: 24_000 }), expense({ amountCents: 40_000, categoryId: 'leisure' })],
            budgets: [limit('2026-10', 'food', 30_000), limit('2026-10', 'leisure', 20_000)],
        });

        const near = itemOf(en.categories.food);
        const over = itemOf(en.categories.leisure);
        expect(near.textContent).toContain('80 %');
        expect(near.classList.contains('budget-bar--over')).toBe(false);
        expect(near.textContent).not.toContain('over by');
        expect(over.textContent).toContain('200 %');
        expect(over.classList.contains('budget-bar--over')).toBe(true);
        expect(over.textContent).toContain('over by €200.00');
    });

    it('hold a limit set in an earlier month, and not one a 0 ended', async () => {
        await open({
            budgets: [
                limit('2026-08', 'food', 30_000),
                limit('2026-10', 'leisure', 0),
                limit('2026-08', 'leisure', 5_000),
            ],
        });

        expect(items().map((item) => item.textContent)).toEqual([expect.stringContaining(en.categories.food)]);
    });

    it('count a credit card expense in the month it is charged', async () => {
        await open({
            expenses: [
                expense({ amountCents: 12_000, payment: 'credit', date: '2026-10-28', chargeDate: '2026-11-12' }),
            ],
            budgets: [limit('2026-08', 'food', 30_000)],
        });

        expect(itemOf(en.categories.food).textContent).toContain('0 %');

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        expect(itemOf(en.categories.food).textContent).toContain('40 %');
    });

    it('count an expense of a category that no longer exists under Other', async () => {
        await open({
            expenses: [expense({ amountCents: 5_000, categoryId: crypto.randomUUID() })],
            budgets: [limit('2026-10', 'other', 10_000)],
        });

        const item = itemOf(en.categories.other);
        expect(item.textContent).toContain('50 %');
    });

    it('are not there for the limit of a category that no longer exists', async () => {
        await open({ budgets: [limit('2026-10', crypto.randomUUID(), 5_000)] });

        expect(bars()).toBeNull();
    });

    it('keep the percentage and the amounts as text, with the drawn bar out of the reach of a screen reader', async () => {
        await open({
            expenses: [expense({ amountCents: 12_000 })],
            budgets: [limit('2026-10', 'food', 30_000)],
        });

        const item = itemOf(en.categories.food);
        expect(item.querySelector('.budget-bar__track')?.getAttribute('aria-hidden')).toBe('true');
        expect(item.querySelector('.budget-bar__track')?.textContent).toBe('');
    });

    it('sit between the numbers of the month and the income form', async () => {
        await open({ budgets: [limit('2026-10', 'food', 30_000)] });

        const spent = screen.getByText(en.summary.spent);
        const income = screen.getByLabelText(/^Income of/);
        expect(spent.compareDocumentPosition(bars()!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(bars()!.compareDocumentPosition(income)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
});
