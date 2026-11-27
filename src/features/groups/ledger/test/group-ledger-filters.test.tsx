import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import {
    ana,
    bea,
    chooseOrder,
    cris,
    dinner,
    euros,
    ledger,
    open,
    rowNames,
    t,
    theLedger,
    trip,
} from '@/lib/testing/group-ledger';
import { sampleSettlement } from '@/lib/testing/groups';
import { optionNames, pickOption } from '@/lib/testing/select';
import { openAddSheet } from '@/lib/testing/sheet';

import type { SharedGroup } from '@core/groups/shared-group';

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the search and the filters of the ledger', () => {
    const lf = ledger.filters;
    const ef = en.expenses.filters;

    const toggle = (count = 0) =>
        within(theLedger()).getByRole('button', { name: t('groups.ledger.filters.toggle', { count }) });
    const sheet = () => screen.getByText(ef.title, { selector: 'h2' }).closest('dialog')!;
    const status = () => theLedger().querySelector<HTMLElement>(':scope > .filter-status')!;

    const seed = (group: SharedGroup) => [
        dinner(group, { text: 'Dinner', date: '2026-10-24', createdAt: 4 }),
        dinner(group, {
            text: 'Taxi',
            categoryId: 'transport',
            date: '2026-10-25',
            amountCents: 900,
            paidBy: bea.id,
            createdAt: 3,
            shares: [
                { memberId: ana.id, cents: 450 },
                { memberId: bea.id, cents: 450 },
            ],
        }),
        dinner(group, {
            text: 'Museum',
            date: '2026-10-26',
            amountCents: 2500,
            paidBy: bea.id,
            createdAt: 2,
            shares: [{ memberId: cris.id, cents: 2500 }],
        }),
        { ...sampleSettlement(group, cris.id, ana.id, 2000), createdAt: 1 },
    ];

    it('opens from one button at the end of the row of the title, with the search first and nothing chosen', async () => {
        const group = trip();
        await open(group, seed(group));

        const head = theLedger().querySelector('.group-ledger__head')!;
        expect(head.contains(toggle())).toBe(true);
        expect(toggle().getAttribute('aria-haspopup')).toBe('dialog');
        expect(sheet().open).toBe(false);
        expect(status().className).toContain('filter-status--idle');

        fireEvent.click(toggle());
        expect(sheet().open).toBe(true);
        const fields = [...sheet().querySelectorAll('input[type="search"], select')];
        expect(fields.map((one) => document.querySelector(`label[for="${one.id}"]`)?.textContent)).toEqual([
            ef.search,
            lf.kind,
            ef.category,
            lf.paidBy,
            lf.with,
        ]);
        expect(optionNames(lf.kind)).toEqual([lf.kinds.all, lf.kinds.expense, lf.kinds.settlement]);
        expect(optionNames(lf.paidBy)).toEqual([lf.anyone, t('groups.names.you', { name: 'Ana' }), 'Bea', 'Cris']);
    });

    it('has no button while the group has no expense', async () => {
        await open(trip());

        expect(within(theLedger()).queryByRole('button', { name: /^Search and filters/ })).toBeNull();
    });

    it('narrows the rows as the search is typed, by the words of the row or its amounts, and says how many are left', async () => {
        const group = trip();
        await open(group, seed(group));
        fireEvent.click(toggle());

        fireEvent.change(within(sheet()).getByRole('searchbox', { name: ef.search }), { target: { value: 'bea' } });
        await waitFor(() => expect(rowNames()).toEqual(['Taxi', 'Museum']));
        expect(within(status()).getByText(t('expenses.filters.showing', { shown: 2, total: 4 }))).toBeDefined();
        expect(toggle(1)).toBeDefined();

        fireEvent.change(within(sheet()).getByRole('searchbox', { name: ef.search }), { target: { value: '4,5' } });
        await waitFor(() => expect(rowNames()).toEqual(['Taxi']));

        fireEvent.change(within(sheet()).getByRole('searchbox', { name: ef.search }), {
            target: { value: 'you paid' },
        });
        await waitFor(() => expect(rowNames()).toEqual(['Dinner', t('groups.ledger.paidYou', { name: 'Cris' })]));
    });

    it('keeps the settlements alone, or what a member paid, or what a member is in', async () => {
        const group = trip();
        await open(group, seed(group));
        fireEvent.click(toggle());

        pickOption(lf.kind, lf.kinds.settlement);
        expect(rowNames()).toEqual([t('groups.ledger.paidYou', { name: 'Cris' })]);
        pickOption(lf.kind, lf.kinds.all);

        pickOption(lf.paidBy, 'Bea');
        expect(rowNames()).toEqual(['Taxi', 'Museum']);
        pickOption(lf.paidBy, lf.anyone);

        pickOption(lf.with, 'Cris');
        expect(rowNames()).toEqual(['Dinner', 'Museum', t('groups.ledger.paidYou', { name: 'Cris' })]);
        expect(toggle(1)).toBeDefined();
    });

    it('says when nothing matches, and Clear brings every row back with the focus on the button', async () => {
        const group = trip();
        await open(group, seed(group));
        fireEvent.click(toggle());
        pickOption(lf.paidBy, 'Cris');
        pickOption(lf.kind, lf.kinds.expense);
        fireEvent.click(within(sheet()).getByRole('button', { name: ef.close }));

        expect(rowNames()).toEqual([]);
        expect(within(status()).getByText(en.expenses.list.noMatch)).toBeDefined();
        fireEvent.click(within(status()).getByRole('button', { name: ef.clear }));

        expect(rowNames()).toHaveLength(4);
        expect(document.activeElement).toBe(toggle());
        expect(status().className).toContain('filter-status--idle');
    });

    it('drops every filter in the sheet with Clear filters, the search too', async () => {
        const group = trip();
        await open(group, seed(group));
        fireEvent.click(toggle());
        const clearFilters = within(sheet()).getByRole('button', { name: ef.clearFilters });
        expect((clearFilters as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(within(sheet()).getByRole('searchbox', { name: ef.search }), { target: { value: 'taxi' } });
        pickOption(lf.kind, lf.kinds.expense);
        await waitFor(() => expect(toggle(2)).toBeDefined());
        fireEvent.click(clearFilters);

        await waitFor(() => expect(rowNames()).toHaveLength(4));
        expect((within(sheet()).getByRole('searchbox', { name: ef.search }) as HTMLInputElement).value).toBe('');
    });

    it('is there in a closed group too, which can still be read', async () => {
        const group = trip({ closed: 'deleted' });
        await open(group, seed(group));
        fireEvent.click(toggle());

        pickOption(lf.kind, lf.kinds.settlement);

        expect(rowNames()).toEqual([t('groups.ledger.paidYou', { name: 'Cris' })]);
    });

    it('starts Show more over at 100 rows when a filter changes', async () => {
        const group = trip();
        const many = Array.from({ length: 250 }, (_, index) =>
            dinner(group, { text: `Row ${index}`, createdAt: 1_000 - index })
        );
        await open(group, many);
        fireEvent.click(within(theLedger()).getByRole('button', { name: en.expenses.list.showMore }));
        expect(rowNames()).toHaveLength(200);

        fireEvent.click(toggle());
        pickOption(lf.kind, lf.kinds.expense);

        expect(rowNames()).toHaveLength(100);
    });

    it('adds up a day of the rows it shows only', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'Dinner', date: '2026-10-24', createdAt: 2 }),
            dinner(group, {
                text: 'Taxi',
                date: '2026-10-24',
                amountCents: 900,
                paidBy: bea.id,
                createdAt: 1,
                shares: [
                    { memberId: ana.id, cents: 450 },
                    { memberId: bea.id, cents: 450 },
                ],
            }),
        ]);
        chooseOrder(ledger.order.date);
        const total = () => theLedger().querySelector('.expense-list__subtotal')?.textContent;
        const both = total();

        fireEvent.click(toggle());
        pickOption(lf.paidBy, 'Bea');

        expect(rowNames()).toEqual(['Taxi']);
        expect(total()).not.toBe(both);
        expect(total()).toContain(euros(450));
    });

    it('drops the search and the filters once the form adds an expense, so it is never hidden', async () => {
        const group = trip();
        const { api } = await open(group, seed(group));
        fireEvent.click(toggle());
        pickOption(lf.kind, lf.kinds.settlement);
        fireEvent.click(within(sheet()).getByRole('button', { name: ef.close }));
        expect(rowNames()).toHaveLength(1);

        const form = await openAddSheet();
        fireEvent.change(within(form).getByLabelText(en.expenses.form.amount), { target: { value: '12' } });
        fireEvent.change(within(form).getByLabelText(en.expenses.form.text), { target: { value: 'Snacks' } });
        fireEvent.click(within(form).getByRole('button', { name: en.expenses.form.submit }));
        await waitFor(() => expect(api.entryWrites).toHaveLength(1));

        await waitFor(() => expect(rowNames()).toContain('Snacks'));
        expect(rowNames()).toHaveLength(5);
        expect(toggle(0)).toBeDefined();
    });
});
