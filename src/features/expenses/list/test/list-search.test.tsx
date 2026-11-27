import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import {
    cafe,
    clear,
    f,
    filtersToggle,
    groupHeadings,
    list,
    noMatch,
    open,
    openAll,
    root,
    rowNames,
    search,
    searchBox,
    shop,
    showing,
} from '@/lib/testing/expense-list';
import { expense, field, rowToggle, t } from '@/lib/testing/expenses';

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

describe('the search', () => {
    it('keeps the rows that have every word, ignoring case and accents', async () => {
        await open(list);

        search('CAFE leche');

        expect(rowNames()).toEqual(['Café con leche']);
    });

    it('shows one example of what it finds as its placeholder, a different one as the list opens', async () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.75);
        await open(list);

        expect(searchBox().placeholder).toBe(en.expenses.filters.searchExamples.below);
    });

    it('finds an amount, a whole number or one above a bound, in the language of the app', async () => {
        localStorage.setItem('tarja:locale', 'es');
        await open([
            expense({ text: 'Coche', amountCents: 123_456 }),
            expense({ text: 'Taxi', amountCents: 1230 }),
            expense({ text: 'Menú', amountCents: 1200 }),
        ]);
        const box = screen.getByRole('searchbox', { name: es.expenses.filters.search });

        fireEvent.change(box, { target: { value: '1.234' } });
        expect(rowNames()).toEqual(['Coche']);

        fireEvent.change(box, { target: { value: '12' } });
        expect(rowNames()).toEqual(['Taxi', 'Menú']);

        fireEvent.change(box, { target: { value: '>12,5' } });
        expect(rowNames()).toEqual(['Coche']);
    });

    it('says how many rows are left, with a button to drop the search', async () => {
        await open(list);

        search('shop');

        expect(showing(1, 4)).not.toBeNull();
        expect(showing(1, 4)!.closest('[aria-hidden="true"]')).not.toBeNull();

        clear();

        expect(rowNames()).toHaveLength(4);
        expect(searchBox().value).toBe('');
        expect(showing(1, 4)).toBeNull();
        expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
    });

    it('says so when nothing matches, and Clear brings the rows back', async () => {
        await open(list);

        search('nothing like this');

        expect(rowNames()).toEqual([]);
        expect(noMatch()).not.toBeNull();
        expect(screen.queryByText(en.expenses.list.empty)).toBeNull();
        expect(groupHeadings()).toEqual([]);

        clear();

        expect(rowNames()).toHaveLength(4);
        expect(noMatch()).toBeNull();
    });

    it('does not narrow the list for a blank search', async () => {
        await openAll(list);

        search('   ');

        expect(rowNames()).toHaveLength(4);
        expect(screen.queryByRole('button', { name: f.clear })).toBeNull();
    });

    it('does not count in the Filters toggle', async () => {
        await open(list);

        search('shop');

        expect(filtersToggle(0)).toBeDefined();
    });
});

describe('editing under a search', () => {
    function editRow(name: string) {
        fireEvent.click(rowToggle(name));
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.editItem', { name }) }));
    }

    it('lists an expense whose edited text now matches', async () => {
        await open([cafe, shop]);
        search('cafe');
        expect(rowNames()).toEqual(['Café con leche']);

        editRow('Café con leche');
        fireEvent.change(field(en.expenses.form.text), { target: { value: 'Tea' } });
        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

        await waitFor(() => expect(noMatch()).not.toBeNull());
        expect(rowNames()).toEqual([]);
        expect(document.activeElement).toBe(screen.getByRole('heading', { name: en.expenses.list.title }));

        search('tea');

        expect(rowNames()).toEqual(['Tea']);
    });

    it('stops listing an expense whose text it changed to something that does not match, and lists another that does', async () => {
        await open([cafe, shop]);
        search('cafe');

        editRow('Café con leche');
        fireEvent.change(field(en.expenses.form.text), { target: { value: 'Cafe run' } });
        fireEvent.click(screen.getByRole('button', { name: en.expenses.form.save }));

        await waitFor(() => expect(rowNames()).toEqual(['Cafe run']));
        expect(showing(1, 2)).not.toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(rowToggle('Cafe run')));
    });
});
