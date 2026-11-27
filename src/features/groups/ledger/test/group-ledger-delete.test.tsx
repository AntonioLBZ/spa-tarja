import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import {
    ana,
    bea,
    chooseOrder,
    days,
    dinner,
    ledger,
    longDay,
    open,
    rowNames,
    rowOf,
    t,
    theLedger,
    trip,
} from '@/lib/testing/group-ledger';
import { person, sampleSettlement } from '@/lib/testing/groups';

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('deleting an entry of the ledger', () => {
    const NOW = new Date(2026, 9, 25, 12).getTime();

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
        document.documentElement.style.removeProperty('--duration-base');
    });

    function toggle(name: string) {
        return within(theLedger()).getByText(name).closest('button')!;
    }

    function remove(name: string) {
        fireEvent.click(toggle(name));
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.deleteItem', { name }) }));
    }

    function undo() {
        fireEvent.click(screen.getByRole('button', { name: en.expenses.list.undo }));
    }

    it('opens a row on what can be done to it', async () => {
        const group = trip();
        await open(group, [dinner(group, { text: 'Dinner' })]);

        fireEvent.click(toggle('Dinner'));

        expect(toggle('Dinner').getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('button', { name: t('expenses.list.deleteItem', { name: 'Dinner' }) })).toBeDefined();
    });

    it('asks nothing, writes a later deleted version and says from which group, with Undo', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group, { text: 'Dinner', updatedAt: 1_000 })]);

        remove('Dinner');

        expect(await screen.findByText(t('groups.ledger.deleted', { name: 'Dinner', group: 'Trip' }))).toBeDefined();
        expect(screen.getByRole('button', { name: en.expenses.list.undo })).toBeDefined();
        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]).toMatchObject({ text: 'Dinner', deletedAt: NOW, updatedAt: NOW });
        await waitFor(() => expect(within(theLedger()).queryByText('Dinner')).toBeNull());
    });

    it('brings the entry back with Undo, newer than the delete, with the focus on its row', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group, { text: 'Dinner', updatedAt: 1_000 })]);
        remove('Dinner');
        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        await waitFor(() => expect(within(theLedger()).queryByText('Dinner')).toBeNull());

        undo();

        expect(await within(theLedger()).findByText('Dinner')).toBeDefined();
        await waitFor(() => expect(document.activeElement).toBe(toggle('Dinner')));
        await waitFor(() => expect(api.entryWrites).toHaveLength(2));
        expect(api.entryWrites[1]).toMatchObject({ text: 'Dinner', deletedAt: null, updatedAt: NOW + 1 });
    });

    it('fades the row out before it goes, with its buttons off meanwhile', async () => {
        document.documentElement.style.setProperty('--duration-base', '200ms');
        const group = trip();
        await open(group, [dinner(group, { text: 'Dinner' })]);

        remove('Dinner');

        expect(rowOf('Dinner').classList.contains('expense-item--leaving')).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: t('expenses.list.deleteItem', { name: 'Dinner' }),
                }) as HTMLButtonElement
            ).disabled
        ).toBe(true);
        await waitFor(() => expect(within(theLedger()).queryByText('Dinner')).toBeNull());
    });

    it('moves the focus to the next row, else to the one before, else to the title', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'First', createdAt: 3 }),
            dinner(group, { text: 'Second', createdAt: 2 }),
            dinner(group, { text: 'Third', createdAt: 1 }),
        ]);

        remove('Second');
        expect(document.activeElement).toBe(toggle('Third'));
        await waitFor(() => expect(within(theLedger()).queryByText('Second')).toBeNull());

        remove('Third');
        expect(document.activeElement).toBe(toggle('First'));
        await waitFor(() => expect(within(theLedger()).queryByText('Third')).toBeNull());

        remove('First');
        expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: ledger.title }));
    });

    it('moves the focus on to the next day when it was the last row of its own, in the ledger by date', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'Today', date: '2026-10-25', createdAt: 1 }),
            dinner(group, { text: 'Before', date: '2026-10-24', createdAt: 2 }),
        ]);
        chooseOrder(ledger.order.date);

        remove('Today');

        expect(document.activeElement).toBe(toggle('Before'));
        await waitFor(() => expect(within(theLedger()).queryByText('Today')).toBeNull());
        expect(days()).toEqual([longDay('2026-10-24')]);
    });

    it('follows the order of the list, not the dates, to the next row and back to the one that returns', async () => {
        const group = trip();
        const { api } = await open(group, [
            dinner(group, { text: 'First', date: '2026-01-01', createdAt: 3 }),
            dinner(group, { text: 'Second', date: '2026-10-01', createdAt: 2 }),
            dinner(group, { text: 'Third', date: '2026-05-01', createdAt: 1 }),
        ]);

        remove('First');
        expect(document.activeElement).toBe(toggle('Second'));
        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        await waitFor(() => expect(within(theLedger()).queryByText('First')).toBeNull());

        undo();

        await waitFor(() => expect(document.activeElement).toBe(toggle('First')));
        expect(rowNames()).toEqual(['First', 'Second', 'Third']);
    });

    it('sends only the entry as it was when the delete was taken back before it was sent', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group, { text: 'Dinner', updatedAt: 1_000 })]);
        onlineManager.setOnline(false);
        remove('Dinner');
        await waitFor(() => expect(within(theLedger()).queryByText('Dinner')).toBeNull());

        undo();
        expect(await within(theLedger()).findByText('Dinner')).toBeDefined();
        onlineManager.setOnline(true);

        await waitFor(() => expect(api.entryAttempts).toHaveLength(1));
        expect(api.entryAttempts[0]).toMatchObject({ deletedAt: null, updatedAt: NOW + 1 });
    });

    it('deletes a settlement and names it by who paid whom', async () => {
        const group = trip();
        const { api } = await open(group, [sampleSettlement(group, ana.id, bea.id, 500)]);
        const name = t('groups.ledger.youPaidTo', { name: 'Bea' });

        fireEvent.click(toggle(name));
        expect(screen.queryByRole('button', { name: t('expenses.list.duplicateItem', { name }) })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: t('expenses.list.deleteItem', { name }) }));

        expect(await screen.findByText(t('groups.ledger.deletedSettlement', { name, group: 'Trip' }))).toBeDefined();
        await waitFor(() => expect(api.entryWrites).toMatchObject([{ kind: 'settlement', deletedAt: NOW }]));
    });

    it('deletes, and takes back, an entry that names somebody who left', async () => {
        const gone = person('Dani', { leftAt: 1 });
        const group = trip({ members: [ana, bea, gone] });
        const { api } = await open(group, [
            dinner(group, {
                text: 'Dinner',
                shares: [
                    { memberId: ana.id, cents: 1500 },
                    { memberId: gone.id, cents: 1500 },
                ],
            }),
        ]);

        remove('Dinner');
        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        undo();

        await waitFor(() => expect(api.entryWrites).toHaveLength(2));
        expect(api.entryWrites[1]!.shares).toEqual([
            { memberId: ana.id, cents: 1500 },
            { memberId: gone.id, cents: 1500 },
        ]);
    });

    it('lets only the last delete be taken back', async () => {
        const group = trip();
        await open(group, [dinner(group, { text: 'First', createdAt: 2 }), dinner(group, { text: 'Second' })]);

        remove('First');
        await screen.findByText(t('groups.ledger.deleted', { name: 'First', group: 'Trip' }));
        remove('Second');

        expect(await screen.findByText(t('groups.ledger.deleted', { name: 'Second', group: 'Trip' }))).toBeDefined();
        expect(screen.queryByText(t('groups.ledger.deleted', { name: 'First', group: 'Trip' }))).toBeNull();
        expect(screen.getAllByRole('button', { name: en.expenses.list.undo })).toHaveLength(1);
    });

    it('says why Undo did nothing when the group closed meanwhile', async () => {
        const group = trip();
        const { app } = await open(group, [dinner(group, { text: 'Dinner' })]);
        remove('Dinner');
        await screen.findByText(t('groups.ledger.deleted', { name: 'Dinner', group: 'Trip' }));

        act(() => app.queryClient.setQueryData(GROUPS_KEY, [{ ...group, closed: 'deleted' }]));
        undo();

        expect(await screen.findByText(en.groups.failure.readOnly)).toBeDefined();
    });
});
