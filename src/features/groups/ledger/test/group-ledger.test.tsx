import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import {
    amountOf,
    ana,
    bea,
    chooseOrder,
    cris,
    days,
    details,
    dinner,
    euros,
    ledger,
    longDay,
    open,
    orderGroup,
    orderRadio,
    rowNames,
    rowOf,
    shortDay,
    spoken,
    t,
    theLedger,
    trip,
} from '@/lib/testing/group-ledger';
import { sampleSettlement } from '@/lib/testing/groups';
import { formatAmount } from '@core/basics/money';

import type { SharedGroup } from '@core/groups/shared-group';

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the ledger of a group', () => {
    it('by date lists the newest day first and, within a day, the latest made first, with what the day does to you', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'Dinner', date: '2026-10-24', createdAt: 1 }),
            dinner(group, {
                text: 'Taxi',
                date: '2026-10-25',
                amountCents: 1500,
                createdAt: 1,
                shares: [{ memberId: ana.id, cents: 1500 }],
            }),
            dinner(group, { text: 'Museum', date: '2026-10-25', createdAt: 3 }),
            { ...sampleSettlement(group, bea.id, ana.id, 500), createdAt: 2 },
        ]);
        chooseOrder(ledger.order.date);

        expect(days()).toEqual([longDay('2026-10-25'), longDay('2026-10-24')]);
        expect(rowNames()).toEqual(['Museum', t('groups.ledger.paidYou', { name: 'Bea' }), 'Taxi', 'Dinner']);
        const today = screen.getByRole('heading', { level: 3, name: longDay('2026-10-25') }).closest('section')!;
        expect(today.querySelector('.expense-list__subtotal')?.textContent).toBe(`+${euros(2000)}`);
    });

    it('shows who paid the whole and what each expense does to your balance, in one sentence aloud', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'Dinner' }),
            dinner(group, { text: 'Taxi', paidBy: bea.id }),
            dinner(group, {
                text: 'Gift',
                paidBy: bea.id,
                amountCents: 2000,
                shares: [
                    { memberId: bea.id, cents: 1000 },
                    { memberId: cris.id, cents: 1000 },
                ],
            }),
        ]);
        chooseOrder(ledger.order.date);

        expect(amountOf('Dinner')).toBe(`+${euros(2000)}`);
        expect(details('Dinner')).toEqual([t('groups.ledger.youPaidTotal', { total: euros(3000) })]);
        expect(amountOf('Taxi')).toBe(`−${euros(1000)}`);
        expect(details('Taxi')).toEqual([t('groups.ledger.paidTotal', { name: 'Bea', total: euros(3000) })]);
        expect(amountOf('Gift')).toBeNull();
        expect(details('Gift')).toEqual([
            t('groups.ledger.paidTotal', { name: 'Bea', total: euros(2000) }),
            ledger.notIn,
        ]);
        expect(spoken('Dinner')).toBe(
            t('groups.ledger.spoken.lent', { name: 'Dinner', total: euros(3000), amount: euros(2000) })
        );
        expect(spoken('Taxi')).toBe(
            t('groups.ledger.spoken.borrowed', { name: 'Taxi', payer: 'Bea', total: euros(3000), amount: euros(1000) })
        );
        expect(spoken('Gift')).toBe(
            t('groups.ledger.spoken.notIn', { name: 'Gift', payer: 'Bea', total: euros(2000) })
        );
    });

    it('says an expense of yours alone is just yours, with no amount', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'Book', amountCents: 1500, shares: [{ memberId: ana.id, cents: 1500 }] }),
        ]);

        expect(amountOf('Book')).toBeNull();
        expect(details('Book').slice(1)).toEqual([
            t('groups.ledger.youPaidTotal', { total: euros(1500) }),
            ledger.justYou,
        ]);
    });

    it('colors what an entry does to you as the person allows, with no arrow', async () => {
        const group = trip();
        await open(group, [dinner(group, { text: 'Dinner' })]);

        const effect = rowOf('Dinner').querySelector('.amount')!;
        expect(effect.classList.contains('amount--in')).toBe(true);
        expect(effect.querySelector('svg')).toBeNull();
    });

    it('opens an expense to who paid and each share, before its actions', async () => {
        const group = trip();
        await open(group, [dinner(group, { text: 'Taxi', paidBy: bea.id })]);

        fireEvent.click(within(rowOf('Taxi')).getAllByRole('button')[0]!);

        const breakdown = within(rowOf('Taxi')).getByRole('list', { name: ledger.breakdown });
        expect(
            within(breakdown)
                .getAllByRole('listitem')
                .map((item) => item.textContent)
        ).toEqual([
            `${t('groups.ledger.paidBy', { name: 'Bea' })}${euros(3000)}`,
            `${t('groups.names.you', { name: 'Ana' })}${euros(1000)}`,
            `Bea${euros(1000)}`,
            `Cris${euros(1000)}`,
        ]);
        expect(
            breakdown.compareDocumentPosition(within(rowOf('Taxi')).getByRole('button', { name: /^Edit/ })) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('names an expense with no text by its category, with its badge', async () => {
        const group = trip();
        await open(group, [dinner(group, { text: '', categoryId: 'leisure' })]);

        const row = rowOf(en.categories.leisure);
        expect(row.querySelector('.category-badge')).not.toBeNull();
    });

    it('says a settlement in words, with its amount and no category', async () => {
        const group = trip();
        await open(group, [
            { ...sampleSettlement(group, ana.id, bea.id, 1200), createdAt: 3 },
            { ...sampleSettlement(group, bea.id, ana.id, 800), createdAt: 2 },
            { ...sampleSettlement(group, bea.id, cris.id, 400), createdAt: 1 },
        ]);

        expect(rowNames()).toEqual([
            t('groups.ledger.youPaidTo', { name: 'Bea' }),
            t('groups.ledger.paidYou', { name: 'Bea' }),
            t('groups.ledger.paid', { from: 'Bea', to: 'Cris' }),
        ]);
        const first = rowOf(t('groups.ledger.youPaidTo', { name: 'Bea' }));
        expect(amountOf(t('groups.ledger.youPaidTo', { name: 'Bea' }))).toBe(euros(1200));
        expect(details(t('groups.ledger.youPaidTo', { name: 'Bea' })).slice(1)).toEqual([]);
        expect(amountOf(t('groups.ledger.paidYou', { name: 'Bea' }))).toBe(euros(800));
        expect(rowOf(t('groups.ledger.paidYou', { name: 'Bea' })).querySelector('.amount')!.className).toBe('amount');
        const others = t('groups.ledger.paid', { from: 'Bea', to: 'Cris' });
        expect(amountOf(others)).toBe(euros(400));
        expect(details(others)).toHaveLength(1);
        expect(first.querySelector('.category-badge')).toBeNull();
        expect(first.classList.contains('ledger-row--settlement')).toBe(true);
        expect(
            first
                .querySelector('.expense-item__name > .ledger-row__mark:first-child [data-icon]')
                ?.getAttribute('data-icon')
        ).toBe('payments');
        expect(theLedger().querySelector('.expense-list__total')).toBeNull();
    });

    it('says who added or last edited an entry when it was not you, only once its row is open', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'Dinner', createdBy: bea.id, updatedBy: bea.id }),
            dinner(group, { text: 'Taxi', createdAt: 1, updatedAt: 5, createdBy: ana.id, updatedBy: cris.id }),
            dinner(group, { text: 'Lunch', createdAt: 1, updatedAt: 5, createdBy: bea.id, updatedBy: ana.id }),
            dinner(group, { text: 'Bus', createdBy: null, updatedBy: null }),
        ]);

        const wrote = (name: string) => {
            expect(details(name).join(' ')).not.toMatch(/Added by|Edited by/);
            fireEvent.click(within(rowOf(name)).getAllByRole('button')[0]!);
            return rowOf(name).querySelector('.ledger-row__wrote')?.textContent ?? null;
        };

        expect(wrote('Dinner')).toBe(t('groups.ledger.addedBy', { name: 'Bea' }));
        expect(wrote('Taxi')).toBe(t('groups.ledger.editedBy', { name: 'Cris' }));
        expect(wrote('Lunch')).toBeNull();
        expect(wrote('Bus')).toBe(t('groups.ledger.addedBy', { name: en.groups.names.deleted }));
    });

    it('marks what is not synced yet, and drops what is deleted', async () => {
        const group = trip();
        const { app } = await open(group, [
            dinner(group, { text: 'Dinner' }),
            dinner(group, { text: 'Gone', deletedAt: 2, updatedAt: 2 }),
        ]);
        onlineManager.setOnline(false);

        await act(() => app.groupOutbox.put(dinner(group, { text: 'Taxi' })));

        expect(await within(theLedger()).findByText('Taxi')).toBeDefined();
        expect(details('Taxi')).toContain(en.expenses.list.pending);
        expect(details('Dinner')).not.toContain(en.expenses.list.pending);
        expect(within(theLedger()).queryByText('Gone')).toBeNull();
    });

    it('says so while the group has no entry', async () => {
        await open(trip());

        expect(within(theLedger()).getByText(ledger.empty)).toBeDefined();
    });

    it('draws 100 rows and adds 100 more with Show more, the focus on the first new row', async () => {
        const group = trip();
        const many = Array.from({ length: 150 }, (_, index) =>
            dinner(group, { text: `Row ${index}`, createdAt: 1_000 - index })
        );
        await open(group, many);

        expect(rowNames()).toHaveLength(100);
        fireEvent.click(within(theLedger()).getByRole('button', { name: en.expenses.list.showMore }));

        expect(rowNames()).toHaveLength(150);
        expect(within(theLedger()).queryByRole('button', { name: en.expenses.list.showMore })).toBeNull();
        await waitFor(() => expect(rowOf('Row 100').contains(document.activeElement)).toBe(true));
    });

    it.each(['deleted', 'left'] as const)(
        'shows the entries of a group closed as %s, an expense opening to its breakdown alone',
        async (closed) => {
            const group = trip({ closed });
            await open(group, [
                { ...dinner(group, { text: 'Dinner' }), createdAt: 2 },
                { ...sampleSettlement(group, bea.id, ana.id, 500), createdAt: 1 },
            ]);

            expect(rowNames()).toEqual(['Dinner', t('groups.ledger.paidYou', { name: 'Bea' })]);
            const rowButtons = () =>
                within(theLedger())
                    .getAllByRole('listitem')
                    .flatMap((row) => within(row).queryAllByRole('button'));
            expect(rowButtons()).toHaveLength(1);
            fireEvent.click(rowButtons()[0]!);
            expect(within(rowOf('Dinner')).getByRole('list', { name: ledger.breakdown })).toBeDefined();
            expect(rowButtons()).toHaveLength(1);
        }
    );

    it('is under the link to the settings of the group', async () => {
        const group = trip();
        await open(group, [dinner(group, { text: 'Dinner' })]);

        const edit = screen.getByRole('link', { name: en.groups.edit.link });
        expect(theLedger().compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });

    it('speaks Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const tEs = createTranslator({ locale: 'es', messages: es });
        const group = trip();
        await open(group, [dinner(group, { text: 'Cena', paidBy: bea.id })]);
        const order = within(theLedger()).getByRole('group', { name: es.groups.ledger.order.legend });

        expect(
            within(order)
                .getAllByRole('radio')
                .map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent)
        ).toEqual([es.groups.ledger.order.added, es.groups.ledger.order.date]);
        fireEvent.click(within(order).getByRole('radio', { name: es.groups.ledger.order.date }));

        const amount = formatAmount(1000, 'EUR', 'es');
        expect(screen.getByRole('heading', { level: 2, name: es.groups.ledger.title })).toBeDefined();
        expect(amountOf('Cena')).toBe(`−${amount}`);
        expect(details('Cena')).toEqual([
            tEs('groups.ledger.paidTotal', { name: 'Bea', total: formatAmount(3000, 'EUR', 'es') }),
        ]);
        expect(days()).toEqual([longDay('2026-10-25', 'es')]);
    });
});

describe('the order of the ledger', () => {
    const NOW = new Date(2026, 10, 6, 12).getTime();

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function twoDays(group: SharedGroup) {
        return [
            dinner(group, { text: 'Yesterday', date: '2026-11-05', createdAt: 1 }),
            dinner(group, { text: 'Months ago', date: '2026-08-01', createdAt: 2 }),
        ];
    }

    it('is a labelled choice of two, with the most recently added first', async () => {
        const group = trip();
        await open(group, twoDays(group));

        const radios = within(orderGroup()).getAllByRole('radio') as HTMLInputElement[];
        expect(radios.map((radio) => radio.labels?.[0]?.textContent)).toEqual([ledger.order.added, ledger.order.date]);
        expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
        expect(radios.every((radio) => !radio.disabled && radio.tabIndex !== -1)).toBe(true);
        expect(radios.map((radio) => radio.checked)).toEqual([true, false]);
    });

    it('is under the title and over the first row', async () => {
        const group = trip();
        await open(group, twoDays(group));

        const title = within(theLedger()).getByRole('heading', { level: 2, name: ledger.title });
        expect(title.compareDocumentPosition(orderGroup()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(
            orderGroup().compareDocumentPosition(rowOf('Yesterday')) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('is not there while the group has no entry', async () => {
        await open(trip());

        expect(within(theLedger()).queryByRole('group', { name: ledger.order.legend })).toBeNull();
        expect(within(theLedger()).getByText(ledger.empty)).toBeDefined();
    });

    it('puts the expense added last first, however old its date, over one of yesterday added before', async () => {
        const group = trip();
        await open(group, twoDays(group));

        expect(rowNames()).toEqual(['Months ago', 'Yesterday']);
    });

    it('keeps an edit from moving an entry, as the order is the one they were made in', async () => {
        const group = trip();
        await open(group, [
            ...twoDays(group),
            dinner(group, { text: 'Edited', date: '2026-10-01', createdAt: 0, updatedAt: 99 }),
        ]);

        expect(rowNames()).toEqual(['Months ago', 'Yesterday', 'Edited']);
    });

    it.each([false, true])(
        'breaks a tie of the time made by the id, so the order is stable (reversed %s)',
        async (reversed) => {
            const group = trip();
            const made = [
                dinner(group, { id: '00000000-0000-4000-8000-000000000001', text: 'One', createdAt: 5 }),
                dinner(group, { id: '00000000-0000-4000-8000-000000000002', text: 'Two', createdAt: 5 }),
                dinner(group, { id: '00000000-0000-4000-8000-000000000003', text: 'Three', createdAt: 5 }),
            ];
            await open(group, reversed ? made.toReversed() : made);

            expect(rowNames()).toEqual(['One', 'Two', 'Three']);
        }
    );

    it('is one sheet with no day and no total, settlements among the rows', async () => {
        const group = trip();
        await open(group, [...twoDays(group), { ...sampleSettlement(group, bea.id, ana.id, 500), createdAt: 3 }]);

        expect(days()).toEqual([]);
        expect(theLedger().querySelectorAll('.sheet')).toHaveLength(1);
        expect(theLedger().querySelector('.sheet__label')).toBeNull();
        expect(theLedger().querySelector('.expense-list__total')).toBeNull();
        expect(rowNames()).toEqual([t('groups.ledger.paidYou', { name: 'Bea' }), 'Months ago', 'Yesterday']);
    });

    it('says the date of each row first in its details, with the year when it is not this year', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'Latest', date: '2026-10-25', createdAt: 3 }),
            dinner(group, { text: 'Old', date: '2025-12-31', createdAt: 2 }),
            { ...sampleSettlement(group, bea.id, ana.id, 500), date: '2026-01-02', createdAt: 1 },
        ]);

        expect(details('Latest')[0]).toBe(shortDay('2026-10-25', false));
        expect(details('Old')[0]).toBe(shortDay('2025-12-31', true));
        const settlement = t('groups.ledger.paidYou', { name: 'Bea' });
        expect(details(settlement)).toEqual([shortDay('2026-01-02', false)]);
        expect(details('Latest')).toContain(t('groups.ledger.youPaidTotal', { total: euros(3000) }));
    });

    it('says the date in the language of the app', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const group = trip();
        await open(group, [dinner(group, { text: 'Cena', date: '2025-12-31' })]);

        const spanish = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
        expect(details('Cena')[0]).toBe(spanish.format(new Date('2025-12-31T12:00:00')));
    });

    it('by date gives back the days with their totals and no date in the rows', async () => {
        const group = trip();
        await open(group, twoDays(group));

        chooseOrder(ledger.order.date);

        expect(orderRadio(ledger.order.date)).toHaveProperty('checked', true);
        expect(days()).toEqual([longDay('2026-11-05'), longDay('2026-08-01')]);
        expect(rowNames()).toEqual(['Yesterday', 'Months ago']);
        const yesterday = screen.getByRole('heading', { level: 3, name: longDay('2026-11-05') }).closest('section')!;
        expect(yesterday.querySelector('.expense-list__subtotal')?.textContent).toBe(`+${euros(2000)}`);
        expect(details('Yesterday')).not.toContain(shortDay('2026-11-05', false));
    });

    it('goes back to the flat list when recently added is chosen again', async () => {
        const group = trip();
        await open(group, twoDays(group));

        chooseOrder(ledger.order.date);
        chooseOrder(ledger.order.added);

        expect(days()).toEqual([]);
        expect(rowNames()).toEqual(['Months ago', 'Yesterday']);
    });

    it('keeps the choice when the ledger is refreshed, and a new entry goes where the order puts it', async () => {
        const group = trip();
        const { app } = await open(group, twoDays(group));
        chooseOrder(ledger.order.date);
        onlineManager.setOnline(false);

        await act(() => app.groupOutbox.put(dinner(group, { text: 'Newest', date: '2026-07-01', createdAt: 9 })));

        expect(await within(theLedger()).findByText('Newest')).toBeDefined();
        expect(orderRadio(ledger.order.date)).toHaveProperty('checked', true);
        expect(rowNames()).toEqual(['Yesterday', 'Months ago', 'Newest']);
    });

    it.each(['added', 'date'] as const)(
        'in %s draws 100 rows and adds the rest with Show more, the focus on the first new row',
        async (order) => {
            const group = trip();
            const many = Array.from({ length: 150 }, (_, index) =>
                dinner(group, {
                    text: `Row ${index}`,
                    date: `2026-10-${String(1 + (index % 28)).padStart(2, '0')}`,
                    createdAt: 1_000 + index,
                })
            );
            await open(group, many);
            chooseOrder(order === 'added' ? ledger.order.added : ledger.order.date);
            const firstOrder = rowNames();

            expect(firstOrder).toHaveLength(100);
            fireEvent.click(within(theLedger()).getByRole('button', { name: en.expenses.list.showMore }));

            expect(rowNames()).toHaveLength(150);
            const firstNew = rowNames()[100]!;
            expect(firstOrder).not.toContain(firstNew);
            await waitFor(() => expect(rowOf(firstNew).contains(document.activeElement)).toBe(true));
        }
    );
});
