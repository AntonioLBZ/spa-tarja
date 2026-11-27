import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { deleteButton, deleteExpense, expense, rowToggle, shown, t } from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { renderApp, stubApi } from '@/lib/testing/render-app';
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

describe('deleting an expense', () => {
    it('marks it as deleted and removes it from the list', async () => {
        const lunch = expense({ text: 'Lunch' });
        const api = createFakeApi({ expenses: [lunch] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteExpense('Lunch');

        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());
        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({ id: lunch.id, text: 'Lunch' });
        expect(api.writes[0]?.deletedAt).toBe(new Date(2026, 9, 25, 12).getTime());
        expect(api.writes[0]?.updatedAt).toBe(new Date(2026, 9, 25, 12).getTime());
    });

    it('wins over a version written by a device whose clock runs ahead', async () => {
        const ahead = new Date(2026, 9, 25, 12).getTime() + 600_000;
        const api = createFakeApi({ expenses: [expense({ text: 'Lunch', updatedAt: ahead })] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteExpense('Lunch');

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.updatedAt).toBe(ahead + 1);
        expect(api.writes[0]?.deletedAt).toBe(ahead + 1);
    });
});

describe('a deleted expense leaving the list', () => {
    const root = document.documentElement;
    const lunch = expense({ text: 'Lunch' });
    const deleteLunch = () => deleteExpense('Lunch');

    afterEach(() => root.style.removeProperty('--duration-base'));

    it('stays on screen, marked, while it fades out, and goes once the fade is over', async () => {
        root.style.setProperty('--duration-base', '60ms');
        const api = createFakeApi({ expenses: [lunch, expense({ text: 'Dinner' })] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteLunch();

        const row = screen.getByText('Lunch').closest('li')!;
        expect(row.className).toContain('expense-item--leaving');
        expect(screen.getByText('Dinner').closest('li')!.className).not.toContain('expense-item--leaving');
        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());
        expect(screen.getByText('Dinner')).toBeDefined();
    });

    it('is saved as deleted at once, not after the fade', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        const api = createFakeApi({ expenses: [lunch] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteLunch();

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]?.deletedAt).not.toBeNull();
        expect(screen.getByText('Lunch')).toBeDefined();
    });

    it('cannot be deleted a second time while it fades', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteLunch();

        expect(deleteButton('Lunch').disabled).toBe(true);
    });

    it('goes at once when there is no motion', async () => {
        root.style.setProperty('--duration-base', '0ms');
        stubApi(createFakeApi({ expenses: [lunch] }).handler);
        renderApp();
        await screen.findByText('Lunch');

        const row = screen.getByText('Lunch').closest('li')!;
        deleteLunch();

        expect(row.className).not.toContain('expense-item--leaving');
        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());
    });
});

describe('a deleted plan leaving the list', () => {
    const root = document.documentElement;
    afterEach(() => root.style.removeProperty('--duration-base'));

    it('keeps its total and every payment on screen while it fades out', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        const plan = crypto.randomUUID();
        const parts = ['2026-10-25', '2026-11-25', '2026-12-25'].map((day, index) =>
            expense({ text: 'Sofa', amountCents: 500, chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        const api = createFakeApi({ expenses: parts });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Sofa');

        deleteExpense('Sofa');

        await waitFor(() => expect(api.writes).toHaveLength(3));
        const row = screen.getByText('Sofa').closest('li')!;
        expect(row.className).toContain('expense-item--leaving');
        expect(row.textContent).toContain('€15.00');
        expect(row.textContent).toContain(t('expenses.list.plan', { parts: 3, date: shown('2026-12-25') }));
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('goes entirely once the fade is over', async () => {
        root.style.setProperty('--duration-base', '60ms');
        const plan = crypto.randomUUID();
        const parts = ['2026-10-25', '2026-11-25', '2026-12-25'].map((day, index) =>
            expense({ text: 'Sofa', chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        stubApi(createFakeApi({ expenses: parts }).handler);
        renderApp();
        await screen.findByText('Sofa');

        deleteExpense('Sofa');

        await waitFor(() => expect(screen.queryByText('Sofa')).toBeNull());
    });
});

describe('undoing a delete', () => {
    const NOW = new Date(2026, 9, 25, 12).getTime();
    const undoButton = () => screen.getByRole('button', { name: en.expenses.list.undo });
    const deletedMessage = (name: string) => t('expenses.list.deleted', { name });

    it('says what was deleted and offers Undo', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: 'Lunch' })] }).handler);
        renderApp();
        await screen.findByText('Lunch');

        deleteExpense('Lunch');

        expect(screen.getByText(deletedMessage('Lunch'))).toBeDefined();
        expect(undoButton()).toBeDefined();
    });

    it('names an expense with no text by its category', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: '' })] }).handler);
        renderApp();
        await screen.findByText(en.categories.food, { selector: '.expense-item__text' });

        deleteExpense(en.categories.food);

        expect(screen.getByText(deletedMessage(en.categories.food))).toBeDefined();
    });

    it('brings the expense back, newer than the delete, and writes it again', async () => {
        const lunch = expense({ text: 'Lunch', updatedAt: 1_000 });
        const api = createFakeApi({ expenses: [lunch] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');
        deleteExpense('Lunch');
        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());
        await waitFor(() => expect(api.writes).toHaveLength(1));

        fireEvent.click(undoButton());

        expect(await screen.findByText('Lunch')).toBeDefined();
        await waitFor(() => expect(api.writes).toHaveLength(2));
        expect(api.writes[0]!.deletedAt).toBe(NOW);
        expect(api.writes[1]).toMatchObject({ id: lunch.id, text: 'Lunch', deletedAt: null, updatedAt: NOW + 1 });
    });

    it('can be dismissed without undoing, which leaves the expense deleted', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: 'Lunch' })] }).handler);
        renderApp();
        await screen.findByText('Lunch');
        deleteExpense('Lunch');

        fireEvent.click(screen.getByRole('button', { name: en.toast.dismiss }));

        expect(screen.queryByText(deletedMessage('Lunch'))).toBeNull();
        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());
    });

    it('goes away once it is used', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: 'Lunch' })] }).handler);
        renderApp();
        await screen.findByText('Lunch');
        deleteExpense('Lunch');

        fireEvent.click(undoButton());

        expect(screen.queryByText(deletedMessage('Lunch'))).toBeNull();
        expect(screen.queryByRole('button', { name: en.expenses.list.undo })).toBeNull();
    });

    it('puts the focus on the row that came back', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: 'Lunch' })] }).handler);
        renderApp();
        await screen.findByText('Lunch');
        deleteExpense('Lunch');

        fireEvent.click(undoButton());

        await waitFor(() => expect(document.activeElement).toBe(rowToggle('Lunch')));
    });

    it('brings a plan back whole, with its total', async () => {
        const plan = crypto.randomUUID();
        const parts = ['2026-10-25', '2026-11-25', '2026-12-25'].map((day, index) =>
            expense({ text: 'Sofa', amountCents: 500, chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        const api = createFakeApi({ expenses: parts });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Sofa');
        deleteExpense('Sofa');
        await waitFor(() => expect(api.writes).toHaveLength(3));
        await waitFor(() => expect(screen.queryByText('Sofa')).toBeNull());

        fireEvent.click(undoButton());

        const row = (await screen.findByText('Sofa')).closest('li')!;
        expect(row.textContent).toContain('€15.00');
        await waitFor(() => expect(api.writes).toHaveLength(6));
        expect(api.writes.slice(3).map((write) => [write.id, write.plan, write.deletedAt])).toEqual(
            parts.map((part) => [part.id, part.plan, null])
        );
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });

    it('sends neither the delete nor anything else about it when the delete had not reached the server yet', async () => {
        const lunch = expense({ text: 'Lunch', updatedAt: 1_000 });
        const api = createFakeApi({ expenses: [lunch] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');
        onlineManager.setOnline(false);
        deleteExpense('Lunch');
        await waitFor(() => expect(screen.queryByText('Lunch')).toBeNull());

        fireEvent.click(undoButton());
        expect(await screen.findByText('Lunch')).toBeDefined();
        onlineManager.setOnline(true);

        await waitFor(() => expect(api.attempts).toHaveLength(1));
        expect(api.attempts[0]).toMatchObject({ id: lunch.id, deletedAt: null, updatedAt: NOW + 1 });
        await waitFor(() => expect(screen.queryByText(en.expenses.list.pending)).toBeNull());
        expect(api.attempts).toHaveLength(1);
    });

    it('works while offline after the delete had reached the server', async () => {
        const api = createFakeApi({ expenses: [expense({ text: 'Lunch', updatedAt: 1_000 })] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');
        deleteExpense('Lunch');
        await waitFor(() => expect(api.writes).toHaveLength(1));
        onlineManager.setOnline(false);

        fireEvent.click(undoButton());

        const row = (await screen.findByText('Lunch')).closest('li')!;
        expect(within(row).getByText(en.expenses.list.pending)).toBeDefined();
        expect(api.writes).toHaveLength(1);
        onlineManager.setOnline(true);
        await waitFor(() => expect(api.writes).toHaveLength(2));
        expect(api.writes[1]!.deletedAt).toBeNull();
    });

    it('is replaced by the next delete, so only the last one can be taken back', async () => {
        const api = createFakeApi({
            expenses: [expense({ text: 'First', date: '2026-10-25' }), expense({ text: 'Second', date: '2026-10-24' })],
        });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('First');
        deleteExpense('First');
        deleteExpense('Second');

        expect(screen.queryByText(deletedMessage('First'))).toBeNull();
        expect(screen.getByText(deletedMessage('Second'))).toBeDefined();
        expect(screen.getAllByRole('button', { name: en.expenses.list.undo })).toHaveLength(1);
        fireEvent.click(undoButton());

        expect(await screen.findByText('Second')).toBeDefined();
        expect(screen.queryByText('First')).toBeNull();
        await waitFor(() => expect(api.writes.filter((write) => write.deletedAt === null)).toHaveLength(1));
    });

    it('survives a change of screen', async () => {
        const api = createFakeApi({ expenses: [expense({ text: 'Lunch' })] });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Lunch');
        deleteExpense('Lunch');
        await waitFor(() => expect(api.writes).toHaveLength(1));

        fireEvent.click(screen.getByRole('link', { name: en.nav.summary }));
        await screen.findByRole('heading', { name: en.summary.title });

        expect(screen.getByText(deletedMessage('Lunch'))).toBeDefined();
        fireEvent.click(undoButton());
        await waitFor(() => expect(api.writes).toHaveLength(2));
        expect(api.writes[1]!.deletedAt).toBeNull();
    });
});

describe('undoing a delete in Spanish', () => {
    const tEs = createTranslator({ locale: 'es', messages: es });

    beforeEach(() => localStorage.setItem('tarja:locale', 'es'));
    afterEach(() => localStorage.clear());

    it('speaks Spanish', async () => {
        stubApi(createFakeApi({ expenses: [expense({ text: 'Cena' })] }).handler);
        renderApp();
        await screen.findByText('Cena');

        fireEvent.click(rowToggle('Cena'));
        fireEvent.click(screen.getByRole('button', { name: tEs('expenses.list.deleteItem', { name: 'Cena' }) }));

        expect(screen.getByText(tEs('expenses.list.deleted', { name: 'Cena' }))).toBeDefined();
        expect(screen.getByRole('button', { name: es.expenses.list.undo })).toBeDefined();
    });
});

describe('the focus after a delete', () => {
    const root = document.documentElement;
    const first = expense({ text: 'First', date: '2026-10-25' });
    const second = expense({ text: 'Second', date: '2026-10-24' });
    const third = expense({ text: 'Third', date: '2026-10-23' });

    afterEach(() => root.style.removeProperty('--duration-base'));

    async function openList(...expenses: Expense[]) {
        stubApi(createFakeApi({ expenses }).handler);
        renderApp();
        await screen.findByText(expenses[0]!.text);
    }

    function listTitle() {
        return screen.getByRole('heading', { name: en.expenses.list.title });
    }

    it('goes to the next row, which is the one that takes the place of the deleted one', async () => {
        await openList(first, second, third);

        deleteExpense('Second');

        expect(document.activeElement).toBe(rowToggle('Third'));
    });

    it('goes to the row before when the deleted one was the last', async () => {
        await openList(first, second, third);

        deleteExpense('Third');

        expect(document.activeElement).toBe(rowToggle('Second'));
    });

    it('goes to the next row of the same day, and past the end of a day to the next one', async () => {
        const later = expense({ text: 'Later', date: '2026-10-25', createdAt: 5_000 });
        await openList(first, later, second);

        deleteExpense('Later');
        expect(document.activeElement).toBe(rowToggle('First'));

        deleteExpense('First');
        expect(document.activeElement).toBe(rowToggle('Second'));
    });

    it('goes to the list title when no row is left', async () => {
        await openList(first);

        deleteExpense('First');

        expect(document.activeElement).toBe(listTitle());
    });

    it('moves at once, while the deleted row is still fading out', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        await openList(first, second);

        deleteExpense('First');

        expect(screen.getByText('First')).toBeDefined();
        expect(document.activeElement).toBe(rowToggle('Second'));
    });

    it('skips a row that is already fading out', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        await openList(first, second, third);
        deleteExpense('Second');

        deleteExpense('Third');

        expect(document.activeElement).toBe(rowToggle('First'));
    });

    it('goes to the title when the only rows left are fading out', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        await openList(first, second);
        deleteExpense('First');

        deleteExpense('Second');

        expect(document.activeElement).toBe(listTitle());
    });

    it('goes to the next row when a whole plan is deleted', async () => {
        const plan = crypto.randomUUID();
        const parts = ['2026-10-24', '2026-11-24'].map((day, index) =>
            expense({
                text: 'Sofa',
                date: '2026-10-24',
                chargeDate: day,
                plan: { id: plan, part: index + 1, parts: 2 },
            })
        );
        await openList(first, ...parts, third);

        deleteExpense('Sofa');

        expect(document.activeElement).toBe(rowToggle('Third'));
    });
});
