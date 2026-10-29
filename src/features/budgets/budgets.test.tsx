import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { BUDGETS_KEY, CATEGORIES_KEY, INCOME_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { DEFAULT_CATEGORY_IDS } from '@core/categories';

import type { Budget } from '@core/budget';
import type { Category } from '@core/category';

const text = en.budgets;

const GYM: Category = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' };

function limit(month: string, scope: string, amountCents: number): Budget {
    return { month, scope, amountCents, currency: 'EUR' };
}

async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi({ categories: [GYM], ...options });
    stubApi(api.handler);
    const app = renderApp({ path: '/budgets' });
    await screen.findByRole('heading', { name: text.title });
    await waitFor(() => {
        expect(app.queryClient.getQueryState(BUDGETS_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(INCOME_KEY)?.status).toBe('success');
        expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success');
    });
    return { api, app };
}

function field(name: string) {
    return screen.getByLabelText(name) as HTMLInputElement;
}

function type(name: string, value: string) {
    fireEvent.change(field(name), { target: { value } });
}

function saveButton() {
    return screen.getByRole('button', { name: text.save }) as HTMLButtonElement;
}

function save() {
    fireEvent.click(saveButton());
}

const food = en.categories.food;
const groceries = en.categories.groceries;
const leisure = en.categories.leisure;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('the budgets screen', () => {
    it('opens on the current month with a hint and an empty field for the total and for each category', async () => {
        await open();

        expect(screen.getByText('October 2026')).toBeDefined();
        expect(screen.getByText(text.hint)).toBeDefined();
        const labels = screen
            .getAllByRole('textbox')
            .map((input) => (input as HTMLInputElement).labels?.[0]?.textContent);
        expect(labels).toEqual([text.total, ...DEFAULT_CATEGORY_IDS.map((id) => en.categories[id]), 'Gym']);
        for (const input of screen.getAllByRole('textbox')) expect((input as HTMLInputElement).value).toBe('');
    });

    it('has no field for a limit of a category that no longer exists', async () => {
        await open({ budgets: [limit('2026-10', crypto.randomUUID(), 5_000)] });

        expect(screen.getAllByRole('textbox')).toHaveLength(1 + DEFAULT_CATEGORY_IDS.length + 1);
    });

    it('moves between months, and the fields start again from what the new month holds', async () => {
        await open();
        type(food, '5');

        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));

        expect(screen.getByText('November 2026')).toBeDefined();
        expect(field(food).value).toBe('');
        expect(saveButton().disabled).toBe(true);
    });
});

describe('a limit the month holds', () => {
    it('fills the field of a limit held from an earlier month and says where it was set', async () => {
        await open({ budgets: [limit('2026-08', 'food', 30_000)] });

        expect(field(food).value).toBe('300.00');
        expect(screen.getByText('Set in August')).toBeDefined();
    });

    it('says nothing of where a limit was set when the month set it itself', async () => {
        await open({ budgets: [limit('2026-10', 'food', 30_000)] });

        expect(field(food).value).toBe('300.00');
        expect(screen.queryByText(/^Set in/)).toBeNull();
    });

    it('leaves the field empty after a 0, which is no limit', async () => {
        await open({ budgets: [limit('2026-08', 'food', 30_000), limit('2026-10', 'food', 0)] });

        expect(field(food).value).toBe('');
    });

    it('names the year of where it was set when it is another one', async () => {
        await open({ budgets: [limit('2025-12', 'food', 30_000)] });

        expect(screen.getByText('Set in December 2025')).toBeDefined();
    });
});

describe('the share of the income', () => {
    const income = [{ month: '2026-10', amountCents: 150_000, currency: 'EUR' }];

    it('is read under each limit when the month has an income, and can go past 100 %', async () => {
        await open({
            income,
            budgets: [limit('2026-10', 'food', 30_000), limit('2026-10', 'total', 300_000)],
        });

        expect(screen.getByText('20 % of the income')).toBeDefined();
        expect(screen.getByText('200 % of the income')).toBeDefined();
        expect(screen.getAllByText(/of the income/)).toHaveLength(2);
    });

    it('follows what is typed', async () => {
        await open({ income });

        type(groceries, '450');

        expect(screen.getByText('30 % of the income')).toBeDefined();
        type(groceries, '');
        expect(screen.queryByText(/of the income/)).toBeNull();
    });

    it('is not there without an income for the month', async () => {
        await open({
            income: [{ month: '2026-09', amountCents: 150_000, currency: 'EUR' }],
            budgets: [limit('2026-10', 'food', 30_000)],
        });

        expect(screen.queryByText(/of the income/)).toBeNull();
    });
});

describe('saving the limits', () => {
    it('is off until a field changes', async () => {
        await open();

        expect(saveButton().disabled).toBe(true);

        type(food, '300');

        expect(saveButton().disabled).toBe(false);
    });

    it('sends the limit that changed, for the month on screen, in one request', async () => {
        const { api } = await open();
        type(food, '300');

        save();

        await waitFor(() =>
            expect(api.budgetBodies).toEqual([{ currency: 'EUR', limits: [{ scope: 'food', amountCents: 30_000 }] }])
        );
        expect(api.budgetRequests).toEqual(['PUT 2026-10']);
    });

    it('sends only the fields that changed', async () => {
        const { api } = await open({ budgets: [limit('2026-08', 'food', 30_000)] });
        type(text.total, '900');
        type(leisure, '50');

        save();

        await waitFor(() =>
            expect(api.budgetBodies).toEqual([
                {
                    currency: 'EUR',
                    limits: [
                        { scope: 'total', amountCents: 90_000 },
                        { scope: 'leisure', amountCents: 5_000 },
                    ],
                },
            ])
        );
    });

    it('sends 0 for a field that had a limit and was emptied', async () => {
        const { api } = await open({ budgets: [limit('2026-08', 'food', 30_000)] });
        type(food, '');

        save();

        await waitFor(() =>
            expect(api.budgetBodies).toEqual([{ currency: 'EUR', limits: [{ scope: 'food', amountCents: 0 }] }])
        );
    });

    it('sends nothing for a field that had no limit and is empty or 0', async () => {
        await open();

        type(leisure, '0');

        expect(saveButton().disabled).toBe(true);
    });

    it('takes typing again the limit a field holds for no change, an inherited one included', async () => {
        await open({ budgets: [limit('2026-08', 'food', 30_000)] });

        type(food, '300');
        expect(saveButton().disabled).toBe(true);
        type(food, '300,00');
        expect(saveButton().disabled).toBe(true);
    });

    it('reads 1.234,50 as 1234.50 and 0,00 as no limit', async () => {
        const { api } = await open({ budgets: [limit('2026-08', 'leisure', 5_000)] });
        type(food, '1.234,50');
        type(leisure, '0,00');

        save();

        await waitFor(() =>
            expect(api.budgetBodies).toEqual([
                {
                    currency: 'EUR',
                    limits: [
                        { scope: 'food', amountCents: 123_450 },
                        { scope: 'leisure', amountCents: 0 },
                    ],
                },
            ])
        );
    });

    it.each(['abc', '-5', '9999999999'])('marks %s as invalid and sends nothing', async (value) => {
        const { api } = await open();
        type(food, value);

        save();

        expect(await screen.findByText(text.invalid)).toBeDefined();
        expect(field(food).getAttribute('aria-invalid')).toBe('true');
        expect(api.budgetRequests).toEqual([]);
    });

    it('sends nothing at all when one field is invalid, whatever the others hold', async () => {
        const { api } = await open();
        type(food, '300');
        type(leisure, 'abc');

        save();

        expect(await screen.findByText(text.invalid)).toBeDefined();
        expect(api.budgetRequests).toEqual([]);
    });

    it('shows what was saved and the following months hold it', async () => {
        await open();
        type(food, '300');

        save();

        await waitFor(() => expect(field(food).value).toBe('300.00'));
        expect(saveButton().disabled).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: en.monthSwitch.next }));
        expect(screen.getByText('November 2026')).toBeDefined();
        expect(field(food).value).toBe('300.00');
        expect(screen.getByText('Set in October')).toBeDefined();
    });

    it('says so and keeps what was typed when the save fails', async () => {
        const { api } = await open();
        api.state.budgetWriteStatus = 500;
        type(food, '300');

        save();

        expect((await screen.findByRole('alert')).textContent).toContain(text.saveFailed);
        expect(field(food).value).toBe('300');
        expect(saveButton().disabled).toBe(false);
    });
});

describe('offline', () => {
    it('turns the form off and says why, with the limits still there from the local copy', async () => {
        await open({ budgets: [limit('2026-10', 'food', 30_000)] });

        onlineManager.setOnline(false);

        expect(await screen.findByText(text.offline)).toBeDefined();
        expect(field(food).value).toBe('300.00');
        for (const input of screen.getAllByRole('textbox')) expect((input as HTMLInputElement).disabled).toBe(true);
        expect(saveButton().disabled).toBe(true);
    });

    it('shows empty, turned off fields when this device never held the budgets', async () => {
        const api = createFakeApi({ categories: [GYM] });
        api.state.offline = true;
        stubApi(api.handler);
        onlineManager.setOnline(false);

        renderApp({ path: '/budgets' });

        await screen.findByRole('heading', { name: text.title });
        expect(screen.getByText(text.offline)).toBeDefined();
        for (const input of screen.getAllByRole('textbox')) {
            expect((input as HTMLInputElement).value).toBe('');
            expect((input as HTMLInputElement).disabled).toBe(true);
        }
        expect(saveButton().disabled).toBe(true);
    });

    it('says the limits could not be loaded when the server fails on a device that holds none', async () => {
        const api = createFakeApi({ categories: [GYM] });
        api.state.offline = true;
        stubApi(api.handler);

        renderApp({ path: '/budgets' });

        expect((await screen.findByRole('alert')).textContent).toContain(text.loadFailed);
    });
});
