import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { openAddSheet } from '@/lib/test/sheet';
import { stubViewport } from '@/lib/test/viewport';

import type { Expense } from '@core/expense';

const t = createTranslator({ locale: 'en', messages: en });

const expense = (overrides: Partial<Expense> = {}): Expense => {
    return {
        id: crypto.randomUUID(),
        categoryId: 'food',
        text: 'Lunch',
        amountCents: 1250,
        currency: 'EUR',
        date: '2026-10-24',
        createdAt: 1_000,
        updatedAt: 1_000,
        deletedAt: null,
        ...overrides,
    };
};

const amountIn = (dialog: HTMLElement) => {
    return within(dialog).getByLabelText(en.expenses.form.amount) as HTMLInputElement;
};

const add = async (amount: string, text: string) => {
    const dialog = await openAddSheet();
    fireEvent.change(amountIn(dialog), { target: { value: amount } });
    fireEvent.change(within(dialog).getByLabelText(en.expenses.form.text), { target: { value: text } });
    fireEvent.click(within(dialog).getByRole('button', { name: en.expenses.form.submit }));
};

const closeSheet = (dialog: HTMLElement) => {
    act(() => (dialog as HTMLDialogElement).close());
};

const tapOutside = (dialog: HTMLElement) => {
    fireEvent.pointerDown(dialog, { clientX: -10, clientY: -10 });
    fireEvent.click(dialog, { clientX: -10, clientY: -10 });
};

const openRow = (name: string) => {
    fireEvent.click(screen.getByText(name).closest('button')!);
};

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('the sheet of the add form', () => {
    it('is not in the page before the first plus', async () => {
        stubApi(createFakeApi().handler);
        renderApp();

        await screen.findByRole('button', { name: en.nav.add });

        expect(screen.queryByLabelText(en.expenses.form.amount)).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('opens the add form from the plus, with the focus on Amount', async () => {
        stubApi(createFakeApi().handler);
        renderApp();

        const dialog = await openAddSheet();

        expect(document.activeElement).toBe(amountIn(dialog));
        expect(within(dialog).getByRole('heading', { level: 2, name: en.expenses.form.title })).toBeDefined();
        expect(within(dialog).getByRole('form', { name: en.expenses.form.title })).toBeDefined();
    });

    it('keeps what was typed when it is closed and opened again', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        const dialog = await openAddSheet();
        fireEvent.change(amountIn(dialog), { target: { value: '12' } });

        closeSheet(dialog);
        expect(screen.queryByRole('dialog')).toBeNull();
        const again = await openAddSheet();

        expect(amountIn(again).value).toBe('12');
    });

    it('closes on a tap outside, keeping what was typed', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        const dialog = await openAddSheet();
        fireEvent.change(amountIn(dialog), { target: { value: '12' } });

        tapOutside(dialog);
        expect(screen.queryByRole('dialog')).toBeNull();
        const again = await openAddSheet();

        expect(amountIn(again).value).toBe('12');
    });

    it('closes after an expense is added, and the expense is in the list', async () => {
        stubApi(createFakeApi().handler);
        renderApp();

        await add('12.50', 'Lunch');

        expect(await screen.findByText('Lunch')).toBeDefined();
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('starts the next expense empty', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await add('12.50', 'Lunch');
        await screen.findByText('Lunch');

        const dialog = await openAddSheet();

        expect(amountIn(dialog).value).toBe('');
    });

    it('says the expense was added away from the home screen', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        await add('12.50', 'Lunch');

        expect(await screen.findByText(en.expenses.form.added)).toBeDefined();
    });

    it('does not say so on the home screen, where the row shows in the list', async () => {
        stubApi(createFakeApi().handler);
        renderApp();

        await add('12.50', 'Lunch');
        await screen.findByText('Lunch');

        expect(screen.queryByText(en.expenses.form.added)).toBeNull();
    });

    it('opens and saves with no connection', async () => {
        stubApi(createFakeApi().handler);
        renderApp();
        await screen.findByRole('button', { name: en.nav.add });
        onlineManager.setOnline(false);

        await add('12.50', 'Lunch');

        expect(await screen.findByText('Lunch')).toBeDefined();
        expect(await screen.findByText(en.expenses.list.pending)).toBeDefined();
    });

    it('opens once however many times the plus is pressed', async () => {
        const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
        stubApi(createFakeApi().handler);
        renderApp();

        await openAddSheet();
        fireEvent.click(screen.getByRole('button', { name: en.nav.add }));

        expect(showModal).toHaveBeenCalledTimes(1);
    });
});

describe('Edit and Duplicate', () => {
    const lunch = expense();

    it('open the sheet with the expense, the focus on the dialog and not on a field', async () => {
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp();
        await screen.findByText('Lunch');

        openRow('Lunch');
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Lunch' }) }));

        const dialog = await screen.findByRole('dialog', { name: en.expenses.form.editTitle });
        expect(amountIn(dialog).value).toBe('12.50');
        expect(document.activeElement).toBe(dialog);
    });

    it('end an edit when the sheet is closed, so the plus adds an empty form', async () => {
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp();
        await screen.findByText('Lunch');
        openRow('Lunch');
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Lunch' }) }));
        closeSheet(await screen.findByRole('dialog', { name: en.expenses.form.editTitle }));

        const dialog = await openAddSheet();

        expect(amountIn(dialog).value).toBe('');
    });

    it('stay open on a tap outside, so a stray tap loses no edit', async () => {
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp();
        await screen.findByText('Lunch');
        openRow('Lunch');
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Lunch' }) }));
        const dialog = await screen.findByRole('dialog', { name: en.expenses.form.editTitle });

        tapOutside(dialog);

        expect(screen.getByRole('dialog', { name: en.expenses.form.editTitle })).toBe(dialog);
    });

    it('open a copy of the expense as a new one', async () => {
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp();
        await screen.findByText('Lunch');

        openRow('Lunch');
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.duplicateItem', { name: 'Lunch' }) }));

        const dialog = await screen.findByRole('dialog', { name: en.expenses.form.copyTitle });
        expect(amountIn(dialog).value).toBe('12.50');
    });
});

describe('the way to the sheet', () => {
    it('leaves the logo and Expenses only leading home', async () => {
        stubApi(createFakeApi().handler);
        renderApp({ path: '/settings' });

        fireEvent.click(await screen.findByRole('link', { name: 'Tarja' }));
        await screen.findByText(en.expenses.list.empty);
        expect(screen.queryByRole('dialog')).toBeNull();

        fireEvent.click(screen.getByRole('link', { name: en.nav.settings }));
        fireEvent.click(await screen.findByRole('link', { name: en.nav.expenses }));
        await screen.findByText(en.expenses.list.empty);
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('is the text action of the header on a wide screen, and the only "+"', async () => {
        stubViewport(true);
        stubApi(createFakeApi().handler);
        renderApp();

        const button = await screen.findByRole('button', { name: en.nav.add });

        expect(button.closest('header')).not.toBeNull();
        expect(button.textContent).toBe(en.nav.add);
        expect(screen.getAllByRole('button', { name: en.nav.add })).toHaveLength(1);
        expect(document.querySelector('.bottom-nav')).toBeNull();
    });

    it('opens the add form from the header action of a wide screen', async () => {
        stubViewport(true);
        stubApi(createFakeApi().handler);
        renderApp();

        const dialog = await openAddSheet();

        expect(amountIn(dialog)).toBeDefined();
    });

    it('is the middle item of the bar on a phone', async () => {
        stubViewport(false);
        stubApi(createFakeApi().handler);
        renderApp();

        const nav = await screen.findByRole('navigation', { name: en.nav.label });
        const items = within(nav).getAllByRole('listitem');

        expect(items).toHaveLength(5);
        const button = within(items[2]!).getByRole('button', { name: en.nav.add });
        expect(button.textContent).toBe(en.nav.addWord);
        expect(screen.getAllByRole('button', { name: en.nav.add })).toHaveLength(1);
    });

    it('opens the add form from the bar of a phone', async () => {
        stubViewport(false);
        stubApi(createFakeApi().handler);
        renderApp();

        const dialog = await openAddSheet();

        expect(amountIn(dialog)).toBeDefined();
    });
});
