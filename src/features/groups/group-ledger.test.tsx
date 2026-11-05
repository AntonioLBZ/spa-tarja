import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';

import type { PendingEntry } from '@/lib/offline';
import type { SeededEntry } from '@/lib/test/fake-groups';
import type { SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const ledger = en.groups.ledger;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');
const cris = person('Cris');

function trip(overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ name: 'Trip', members: [ana, bea, cris], me: ana.id, ...overrides });
}

type ExpenseFields = Partial<Extract<PendingEntry, { kind: 'expense' }>> & Pick<SeededEntry, 'createdBy' | 'updatedBy'>;

function dinner(group: SharedGroup, overrides: ExpenseFields = {}): SeededEntry {
    const { createdBy, updatedBy, ...fields } = overrides;
    const entry = sampleEntry(group, {
        amountCents: 3000,
        shares: [
            { memberId: ana.id, cents: 1000 },
            { memberId: bea.id, cents: 1000 },
            { memberId: cris.id, cents: 1000 },
        ],
        ...fields,
    });
    return { ...entry, createdBy, updatedBy };
}

async function open(group: SharedGroup, entries: SeededEntry[] = []) {
    const api = createFakeApi({ groups: [group], entries });
    stubApi(api.handler);
    const app = renderApp({ path: `/groups/${group.id}` });
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(group.id))?.status).toBe('success'));
    return { api, app };
}

function theLedger() {
    return document.querySelector<HTMLElement>('.group-ledger')!;
}

function days() {
    return within(theLedger())
        .queryAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent);
}

function rowNames() {
    return within(theLedger())
        .queryAllByRole('listitem')
        .map((row) => row.querySelector('.expense-item__text')?.textContent);
}

function rowOf(name: string) {
    return within(theLedger()).getByText(name).closest('li')!;
}

function details(name: string) {
    return [...rowOf(name).querySelectorAll('.expense-item__meta > span')].map((span) => span.textContent);
}

function longDay(isoDay: string, locale = 'en') {
    return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
        new Date(`${isoDay}T12:00:00`)
    );
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the ledger of a group', () => {
    it('lists the newest day first and, within a day, the latest made first, with the total of its expenses', async () => {
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

        expect(days()).toEqual([longDay('2026-10-25'), longDay('2026-10-24')]);
        expect(rowNames()).toEqual(['Museum', t('groups.ledger.paidYou', { name: 'Bea' }), 'Taxi', 'Dinner']);
        const today = screen.getByRole('heading', { level: 3, name: longDay('2026-10-25') }).closest('section')!;
        expect(today.querySelector('.expense-list__subtotal')?.textContent).toBe(euros(4500));
    });

    it('shows the total of an expense, who paid and your part', async () => {
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

        expect(within(rowOf('Dinner')).getByText(euros(3000))).toBeDefined();
        expect(details('Dinner')).toEqual([ledger.youPaid, t('groups.ledger.yourPart', { amount: euros(1000) })]);
        expect(details('Taxi')).toEqual([
            t('groups.ledger.paidBy', { name: 'Bea' }),
            t('groups.ledger.yourPart', { amount: euros(1000) }),
        ]);
        expect(details('Gift')).toEqual([t('groups.ledger.paidBy', { name: 'Bea' }), ledger.notIn]);
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
        expect(within(first).getByText(euros(1200))).toBeDefined();
        expect(first.querySelector('.category-badge')).toBeNull();
        expect(theLedger().querySelector('.expense-list__total')).toBeNull();
    });

    it('says who added or last edited an entry when it was not you', async () => {
        const group = trip();
        await open(group, [
            dinner(group, { text: 'Dinner', createdBy: bea.id, updatedBy: bea.id }),
            dinner(group, { text: 'Taxi', createdAt: 1, updatedAt: 5, createdBy: ana.id, updatedBy: cris.id }),
            dinner(group, { text: 'Lunch', createdAt: 1, updatedAt: 5, createdBy: bea.id, updatedBy: ana.id }),
            dinner(group, { text: 'Bus', createdBy: null, updatedBy: null }),
        ]);

        expect(details('Dinner')).toContain(t('groups.ledger.addedBy', { name: 'Bea' }));
        expect(details('Taxi')).toContain(t('groups.ledger.editedBy', { name: 'Cris' }));
        expect(details('Lunch').join(' ')).not.toMatch(/Added by|Edited by/);
        expect(details('Bus')).toContain(t('groups.ledger.addedBy', { name: en.groups.names.deleted }));
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
        'shows the entries of a group closed as %s, with nothing to open',
        async (closed) => {
            const group = trip({ closed });
            await open(group, [dinner(group, { text: 'Dinner' })]);

            expect(rowNames()).toEqual(['Dinner']);
            expect(within(theLedger()).queryAllByRole('button')).toEqual([]);
        }
    );

    it('is under the add form and over the link to the settings of the group', async () => {
        const group = trip();
        await open(group, [dinner(group, { text: 'Dinner' })]);

        const form = screen.getByRole('button', { name: en.expenses.form.title });
        const edit = screen.getByRole('link', { name: en.groups.edit.link });
        expect(form.compareDocumentPosition(theLedger()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(theLedger().compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('speaks Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const tEs = createTranslator({ locale: 'es', messages: es });
        const group = trip();
        await open(group, [dinner(group, { text: 'Cena', paidBy: bea.id })]);

        const amount = formatAmount(1000, 'EUR', 'es');
        expect(screen.getByRole('heading', { level: 2, name: es.groups.ledger.title })).toBeDefined();
        expect(details('Cena')).toEqual([
            tEs('groups.ledger.paidBy', { name: 'Bea' }),
            tEs('groups.ledger.yourPart', { amount }),
        ]);
        expect(days()).toEqual([longDay('2026-10-25', 'es')]);
    });
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
