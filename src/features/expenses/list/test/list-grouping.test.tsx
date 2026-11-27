import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import {
    cafe,
    f,
    filtersToggle,
    format,
    groupHeadings,
    list,
    longDay,
    noMatch,
    open,
    openAll,
    pickGrouping,
    root,
    rowNames,
    search,
    shop,
    showing,
    sofa,
    subtotalOf,
} from '@/lib/testing/expense-list';
import {
    chosenInstallments,
    deleteExpense,
    expense,
    field,
    installmentsLabel,
    rowToggle,
    shown,
    t,
    TODAY,
} from '@/lib/testing/expenses';
import { stubLanguages } from '@/lib/testing/languages';
import { renderApp } from '@/lib/testing/render-app';
import { chosenOption } from '@/lib/testing/select';
import { addMonths } from '@core/basics/date';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    localStorage.clear();
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
    root.style.removeProperty('--duration-base');
});

describe('the groups', () => {
    it('are days to start with, newest first, each with what its rows add up to', async () => {
        await openAll(list);

        expect(groupHeadings()).toEqual([longDay('2026-10-24'), longDay('2026-10-19'), longDay('2026-09-30')]);
        expect(subtotalOf(longDay('2026-10-24'))).toBe('€48.00');
        expect(subtotalOf(longDay('2026-10-19'))).toBe('€9.00');
        expect(subtotalOf(longDay('2026-09-30'))).toBe('€600.00');
    });

    it('start on the day the browser starts the week', async () => {
        stubLanguages(['en-US']);
        await openAll(list);

        pickGrouping(f.group.week);

        expect(groupHeadings()[0]).toBe(
            t('expenses.list.weekOf', { date: format({ month: 'short', day: 'numeric' }, '2026-10-18') })
        );
    });

    it('are months, called by their name', async () => {
        await openAll(list);

        pickGrouping(f.group.month);

        expect(groupHeadings()).toEqual(['October', 'September']);
        expect(subtotalOf('October')).toBe('€57.00');
    });

    it('add the year to the label when they go over a New Year', async () => {
        await openAll([
            expense({ text: 'January', date: '2026-01-02' }),
            expense({ text: 'December', date: '2025-12-30' }),
        ]);

        expect(groupHeadings()).toEqual([
            format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, '2026-01-02'),
            format({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, '2025-12-30'),
        ]);

        pickGrouping(f.group.month);

        expect(groupHeadings()).toEqual(['January 2026', 'December 2025']);
    });

    it('are categories, the biggest subtotal first, each with its icon and name', async () => {
        await openAll(list);

        pickGrouping(f.group.category);

        expect(groupHeadings()).toEqual([
            en.categories.housing,
            en.categories.groceries,
            en.categories.leisure,
            en.categories.food,
        ]);
        expect(subtotalOf(en.categories.housing)).toBe('€600.00');
        const heading = screen.getByRole('heading', { level: 2, name: en.categories.groceries });
        expect(heading.querySelector('.category-badge')).not.toBeNull();
    });

    it('put a category that no longer exists under Other, and leave the expense as it was', async () => {
        const gone = crypto.randomUUID();
        const { api } = await open([expense({ text: 'Monthly fee', categoryId: gone }), cafe]);

        pickGrouping(f.group.category);

        expect(groupHeadings()).toEqual([en.categories.other, en.categories.food]);
        expect(rowNames()).toContain('Monthly fee');
        expect(api.writes).toHaveLength(0);
    });

    it('show the day an expense was made in its details, unless they are days', async () => {
        await open([cafe]);
        const row = () => screen.getByText('Café con leche').closest('li')!;
        expect(row().textContent).not.toContain(shown('2026-10-24'));

        pickGrouping(f.group.week);
        expect(row().textContent).toContain(shown('2026-10-24'));

        pickGrouping(f.group.category);
        expect(row().textContent).toContain(shown('2026-10-24'));

        pickGrouping(f.group.day);
        expect(row().textContent).not.toContain(shown('2026-10-24'));
    });
});

describe('the grouping', () => {
    it('is remembered in the browser', async () => {
        await open(list);

        pickGrouping(f.group.month);

        expect(localStorage.getItem('tarja:list-grouping')).toBe('month');
    });

    it('is the one chosen the last time', async () => {
        const { app } = await open(list);
        pickGrouping(f.group.month);
        app.unmount();

        renderApp();
        await screen.findByText('Cinema');

        expect(groupHeadings()).toEqual(['October']);
        fireEvent.click(filtersToggle());
        expect(chosenOption(f.groupBy)).toBe(f.group.month);
    });

    it('falls back to days for something nobody saved', async () => {
        localStorage.setItem('tarja:list-grouping', 'year');

        await openAll(list);

        expect(groupHeadings()).toHaveLength(3);
        expect(groupHeadings()[0]).toBe(longDay('2026-10-24'));
    });

    it('still works when the browser will not keep it', async () => {
        const getItem = Storage.prototype.getItem;
        const setItem = Storage.prototype.setItem;
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
            if (key === 'tarja:list-grouping') throw new Error('blocked');
            return getItem.call(this, key);
        });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
            if (key === 'tarja:list-grouping') throw new Error('blocked');
            setItem.call(this, key, value);
        });
        await openAll(list);

        pickGrouping(f.group.month);

        expect(groupHeadings()).toEqual(['October', 'September']);
    });
});

describe('Show more', () => {
    function many(count: number) {
        return Array.from({ length: count }, (_, index) =>
            expense({
                text: `Item ${String(index).padStart(3, '0')}`,
                amountCents: 100,
                createdAt: 10_000 + index,
            })
        );
    }
    const showMore = () => screen.queryByRole('button', { name: en.expenses.list.showMore });

    it('is not offered for a short list', async () => {
        await open(many(100), 'Item 099');

        expect(rowNames()).toHaveLength(100);
        expect(showMore()).toBeNull();
    });

    it('draws 100 rows and adds 100 more each time it is pressed', async () => {
        await open(many(230), 'Item 229');
        expect(rowNames()).toHaveLength(100);

        fireEvent.click(showMore()!);
        expect(rowNames()).toHaveLength(200);

        fireEvent.click(showMore()!);
        expect(rowNames()).toHaveLength(230);
        expect(showMore()).toBeNull();
    });

    it('starts over at 100 when the list changes', async () => {
        await open(many(230), 'Item 229');
        fireEvent.click(showMore()!);
        expect(rowNames()).toHaveLength(200);

        search('item');

        expect(rowNames()).toHaveLength(100);
        expect(showMore()).not.toBeNull();
    });

    it('counts the rows that pass the filters, not the ones that do not', async () => {
        await open(many(230), 'Item 229');

        search('item 22');

        expect(rowNames()).toHaveLength(12);
        expect(showMore()).toBeNull();
        expect(showing(12, 230)).not.toBeNull();
    });
});

describe('deleting and editing', () => {
    it('fades a deleted row out under a filter, and then says nothing matches', async () => {
        root.style.setProperty('--duration-base', '60ms');
        await open([cafe, shop]);
        search('shop');

        deleteExpense('Weekly shop');

        expect(screen.getByText('Weekly shop').closest('li')!.className).toContain('expense-item--leaving');
        await waitFor(() => expect(screen.queryByText('Weekly shop')).toBeNull());
        expect(noMatch()).not.toBeNull();
    });

    it('counts the row that fades with the others the filter keeps', async () => {
        root.style.setProperty('--duration-base', '60000ms');
        await open([
            expense({ text: 'Lunch A', createdAt: 3_000 }),
            expense({ text: 'Lunch B', createdAt: 2_000 }),
            expense({ text: 'Dinner', createdAt: 1_000 }),
        ]);
        search('lunch');

        deleteExpense('Lunch A');

        expect(rowNames()).toEqual(['Lunch A', 'Lunch B']);
        expect(showing(2, 3)).not.toBeNull();
    });

    it('takes away the controls once the last expense is deleted', async () => {
        root.style.setProperty('--duration-base', '0ms');
        await open([cafe]);

        deleteExpense('Café con leche');

        await screen.findByText(en.expenses.list.empty);
        expect(screen.queryByRole('searchbox')).toBeNull();
    });

    it('edits the whole plan, not the part the filter looked at', async () => {
        await open([...sofa(), cafe]);
        search('sofa');

        fireEvent.click(rowToggle('Sofa'));
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Sofa' }) }));

        expect(chosenInstallments()).toBe(installmentsLabel(3));
        expect(field(t('expenses.form.part', { part: 3, parts: 3, date: shown(addMonths(TODAY, 2)) })).value).toBe(
            '5.00'
        );
    });

    it('gives the focus back to the row it edited when the filter still shows it', async () => {
        await open([cafe, shop]);
        search('shop');
        fireEvent.click(rowToggle('Weekly shop'));
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Weekly shop' }) }));

        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.cancel }));

        expect(document.activeElement).toBe(rowToggle('Weekly shop'));
    });
});

describe('the cap and the focus', () => {
    function many(count: number) {
        return Array.from({ length: count }, (_, index) =>
            expense({ text: `Item ${String(index).padStart(3, '0')}`, createdAt: 10_000 + index })
        );
    }

    it('goes to the list title when an edit moves the row beyond the rows that are drawn', async () => {
        await open(many(150), 'Item 149');
        fireEvent.click(rowToggle('Item 149'));
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name: 'Item 149' }) }));
        fireEvent.change(field(en.expenses.form.date), { target: { value: '2026-01-01' } });

        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

        await waitFor(() => expect(screen.queryByText('Item 149')).toBeNull());
        expect(rowNames()).toHaveLength(100);
        await waitFor(() =>
            expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.expenses.list.title }))
        );
    });

    it('goes to the first row that Show more brings in', async () => {
        await open(many(230), 'Item 229');

        fireEvent.click(screen.getByRole('button', { name: en.expenses.list.showMore }));

        expect(rowNames()).toHaveLength(200);
        expect(document.activeElement).toBe(rowToggle('Item 129'));
    });

    it('goes to the first row of the last ones too, when the button is gone', async () => {
        await open(many(230), 'Item 229');
        fireEvent.click(screen.getByRole('button', { name: en.expenses.list.showMore }));

        fireEvent.click(screen.getByRole('button', { name: en.expenses.list.showMore }));

        expect(screen.queryByRole('button', { name: en.expenses.list.showMore })).toBeNull();
        expect(rowNames()).toHaveLength(230);
        expect(document.activeElement).toBe(rowToggle('Item 029'));
    });
});
