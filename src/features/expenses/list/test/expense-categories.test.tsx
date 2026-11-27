import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { CATEGORIES_KEY, GROUPS_KEY } from '@/lib/api';
import {
    categoriesLoaded,
    categoryLabels,
    expense,
    field,
    fillAndSubmit,
    lookOf,
    rowToggle,
    t,
} from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { sampleEntry, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { chosenOption, pickOption } from '@/lib/testing/select';
import { ensureAddSheet } from '@/lib/testing/sheet';
import { type Expense } from '@core/expenses/expense';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('custom categories', () => {
    const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;

    it('are offered in the form after the built-in ones, Other first', async () => {
        stubApi(createFakeApi({ categories: [gym] }).handler);
        const app = renderApp();

        await categoriesLoaded(app);
        const { other, ...rest } = en.categories;
        expect(categoryLabels()).toEqual([other, ...Object.values(rest), 'Gym']);
    });

    it('can be picked for an expense, which is saved with the category id', async () => {
        const api = createFakeApi({ categories: [gym] });
        stubApi(api.handler);
        const app = renderApp();
        await categoriesLoaded(app);

        pickOption(en.expenses.form.category, 'Gym');
        fillAndSubmit({ amount: '30', text: 'Monthly fee' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.categoryId).toBe(gym.id);
    });

    it('go back to the suggestion when the picked one is gone', async () => {
        const api = createFakeApi({ categories: [gym] });
        stubApi(api.handler);
        const app = renderApp();
        await categoriesLoaded(app);
        pickOption(en.expenses.form.category, 'Gym');

        app.queryClient.setQueryData(['categories'], []);

        await waitFor(() => expect(chosenOption(en.expenses.form.category)).toBe(en.categories.other));
    });

    it('name the expenses filed under them in the list', async () => {
        stubApi(
            createFakeApi({ categories: [gym], expenses: [expense({ text: 'Monthly fee', categoryId: gym.id })] })
                .handler
        );

        renderApp();

        const row = (await screen.findByText('Monthly fee')).closest('li')!;
        await waitFor(() => expect(within(row).queryByText('Gym')).not.toBeNull());
    });

    it('show as Other once the category is gone', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: 'Monthly fee', categoryId: gym.id })] }).handler);

        renderApp();

        const row = (await screen.findByText('Monthly fee')).closest('li')!;
        expect(within(row).getByText(en.categories.other)).toBeDefined();
    });
});

describe('category looks', () => {
    const gym = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;

    it('mark each row with the icon and color of its category, built-in or not', async () => {
        stubApi(
            createFakeApi({
                categories: [gym],
                expenses: [
                    expense({ text: 'Lunch', categoryId: 'food' }),
                    expense({ text: 'Monthly fee', categoryId: gym.id }),
                    expense({ text: 'Long gone', categoryId: crypto.randomUUID() }),
                ],
            }).handler
        );

        renderApp();

        const row = async (text: string) => (await screen.findByText(text)).closest('li')!;
        expect(lookOf(await row('Lunch'))).toEqual({ icon: 'restaurant', color: 'vermillion' });
        await waitFor(() => expect(lookOf(screen.getByText('Monthly fee').closest('li')!).icon).toBe('fitness_center'));
        expect(lookOf(await row('Monthly fee'))).toEqual({ icon: 'fitness_center', color: 'blue' });
        expect(lookOf(await row('Long gone'))).toEqual({ icon: 'more_horiz', color: 'gray' });
    });

    it('show next to the category picker, following the pick and the suggestion', async () => {
        stubApi(createFakeApi({ categories: [gym] }).handler);
        const app = renderApp();
        await categoriesLoaded(app);
        ensureAddSheet();
        const picker = () =>
            screen.getByRole('combobox', { name: en.expenses.form.category }).closest('.field') as HTMLElement;
        expect(lookOf(picker())).toEqual({ icon: 'more_horiz', color: 'gray' });

        fireEvent.change(field(en.expenses.form.text), { target: { value: 'coffee' } });
        expect(lookOf(picker())).toEqual({ icon: 'restaurant', color: 'vermillion' });

        pickOption(en.expenses.form.category, 'Gym');
        expect(lookOf(picker())).toEqual({ icon: 'fitness_center', color: 'blue' });
    });
});

describe('suggesting a category from your own expenses', () => {
    const GYM = { id: crypto.randomUUID(), name: 'Gym', color: 'blue', icon: 'fitness_center' } as const;
    const label = en.expenses.form.category;
    const typeText = (value: string) => fireEvent.change(field(en.expenses.form.text), { target: { value } });

    async function open(expenses: Expense[], categories: (typeof GYM)[] = []) {
        const api = createFakeApi({ expenses, categories: [...categories] });
        stubApi(api.handler);
        const app = renderApp();
        await screen.findAllByText(expenses[0]!.text);
        await waitFor(() => expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success'));
        return { api, app };
    }

    it('suggests the category of an earlier expense with the same word when the keywords find nothing', async () => {
        await open([expense({ text: 'Padel con Ana', categoryId: 'leisure' })]);

        typeText('Padel');

        expect(chosenOption(label)).toBe(en.categories.leisure);
        expect(screen.getByText(en.expenses.form.suggested)).toBeDefined();
    });

    it('keeps the suggestion of the keywords when they find something', async () => {
        await open([expense({ text: 'Padel', categoryId: 'health' })]);

        typeText('Padel Mercadona');

        expect(chosenOption(label)).toBe(en.categories.groceries);
    });

    it('can suggest a category of your own, which the keywords never do', async () => {
        await open([expense({ text: 'Crossfit', categoryId: GYM.id })], [GYM]);

        typeText('crossfit monday');

        expect(chosenOption(label)).toBe('Gym');
        expect(screen.getByText(en.expenses.form.suggested)).toBeDefined();
    });

    it('learns from your part of a shared expense', async () => {
        const group = sampleGroup();
        stubApi(
            createFakeApi({
                groups: [group],
                entries: [sampleEntry(group, { text: 'Padel con Bea', categoryId: 'leisure' })],
            }).handler
        );
        renderApp();
        await screen.findByText('Padel con Bea');

        typeText('Padel');

        expect(chosenOption(label)).toBe(en.categories.leisure);
        expect(screen.getByText(en.expenses.form.suggested)).toBeDefined();
    });

    it('does not learn from a shared expense of a group whose switch is off', async () => {
        const group = sampleGroup({ showInExpenses: false });
        const api = createFakeApi({
            expenses: [expense({ text: 'Lunch' })],
            groups: [group],
            entries: [sampleEntry(group, { text: 'Padel con Bea', categoryId: 'leisure' })],
        });
        stubApi(api.handler);
        const app = renderApp();
        await screen.findByText('Lunch');
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));

        typeText('Padel');

        expect(chosenOption(label)).toBe(en.categories.other);
        expect(screen.queryByText(en.expenses.form.suggested)).toBeNull();
    });

    it('never replaces a category that was picked by hand', async () => {
        await open([expense({ text: 'Padel', categoryId: 'leisure' })]);

        pickOption(label, en.categories.health);
        typeText('Padel');

        expect(chosenOption(label)).toBe(en.categories.health);
        expect(screen.queryByText(en.expenses.form.suggested)).toBeNull();
    });

    it('learns from a category the person picked, on the very next expense', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        typeText('Padel');
        expect(chosenOption(label)).toBe(en.categories.other);
        pickOption(label, en.categories.leisure);
        fireEvent.change(field(en.expenses.form.amount), { target: { value: '12' } });
        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.submit }));
        await screen.findByRole('listitem');

        typeText('Padel');

        expect(chosenOption(label)).toBe(en.categories.leisure);
        expect(screen.getByText(en.expenses.form.suggested)).toBeDefined();
    });

    it('saves the category that was suggested', async () => {
        const { api } = await open([expense({ text: 'Crossfit', categoryId: GYM.id })], [GYM]);

        fillAndSubmit({ amount: '30', text: 'Crossfit' });

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ categoryId: GYM.id, text: 'Crossfit' });
    });

    it('stays out of an expense being edited, which keeps the category it was saved with', async () => {
        await open([
            expense({ text: 'Padel', categoryId: 'leisure' }),
            expense({ text: 'Lunch', categoryId: 'health', date: '2026-10-20' }),
        ]);
        fireEvent.click(rowToggle('Lunch'));
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Lunch' }) }));

        typeText('Padel');

        expect(chosenOption(label)).toBe(en.categories.health);
        expect(screen.queryByText(en.expenses.form.suggested)).toBeNull();
    });
});
