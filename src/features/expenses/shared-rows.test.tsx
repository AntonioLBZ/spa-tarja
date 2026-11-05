import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { pickOption } from '@/lib/test/select';
import { formatAmount } from '@core/money';

import type { Expense } from '@core/expense';
import type { GroupMember, SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const list = en.expenses.list;
const f = en.expenses.filters;

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

function trip(overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ name: 'Trip to Lisbon', members: [ana, bea], me: ana.id, ...overrides });
}

function friend(name: string) {
    return sampleGroup({ kind: 'direct', name: null, members: [ana, person(name)], me: ana.id });
}

function shares(...parts: Array<[GroupMember, number]>) {
    return parts.map(([member, cents]) => ({ memberId: member.id, cents }));
}

function expense(overrides: Partial<Expense> = {}): Expense {
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
}

async function openHome(options: Parameters<typeof createFakeApi>[0], first: string) {
    const api = createFakeApi(options);
    stubApi(api.handler);
    const app = renderApp();
    await screen.findByText(first);
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    return { api, app };
}

function rowOf(name: string) {
    return screen.getByText(name).closest('li')!;
}

function rowNames() {
    return screen
        .queryAllByRole('listitem')
        .map((row) => row.querySelector('.expense-item__text')?.textContent)
        .filter(Boolean);
}

function search(value: string) {
    fireEvent.change(screen.getByRole('searchbox', { name: f.search }), { target: { value } });
}

function openFilters() {
    const toggle = screen.getByRole('button', { name: /^Filters/ });
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('your part of a shared expense in the list', () => {
    it('shows your part, the group, who paid and the total when it is not your part', async () => {
        const group = trip();
        await openHome(
            {
                groups: [group],
                entries: [
                    sampleEntry(group, {
                        amountCents: 10_000,
                        paidBy: bea.id,
                        shares: shares([ana, 2500], [bea, 7500]),
                        payment: 'credit',
                        chargeDate: '2026-11-24',
                    }),
                    sampleEntry(group, { text: 'Taxi', amountCents: 1500, shares: shares([ana, 1500]) }),
                ],
            },
            'Dinner'
        );

        const dinner = rowOf('Dinner').textContent;
        expect(dinner).toContain(euros(2500));
        expect(dinner).toContain('Trip to Lisbon');
        expect(dinner).toContain(t('expenses.list.paidByTotal', { name: 'Bea', total: euros(10_000) }));
        expect(dinner).not.toContain(en.expenses.payment.credit);
        const taxi = rowOf('Taxi').textContent;
        expect(taxi).toContain(euros(1500));
        expect(taxi).toContain(list.youPaid);
        expect(taxi).not.toContain(t('expenses.list.youPaidTotal', { total: euros(1500) }));
    });

    it('names a friend by the person, and says when you paid by card and when it is charged', async () => {
        const dani = friend('Dani');
        await openHome(
            {
                groups: [dani],
                entries: [
                    sampleEntry(dani, {
                        text: 'Concert',
                        amountCents: 6000,
                        shares: shares([ana, 3000], [dani.members[1]!, 3000]),
                        payment: 'credit',
                        chargeDate: '2026-11-24',
                    }),
                ],
            },
            'Concert'
        );

        const concert = rowOf('Concert').textContent;
        expect(concert).toContain('Dani');
        expect(concert).toContain(t('expenses.list.youPaidTotal', { total: euros(6000) }));
        expect(concert).toContain(en.expenses.payment.credit);
    });

    it('says it is waiting to be sent', async () => {
        const group = trip();
        const { app } = await openHome({ expenses: [expense()], groups: [group] }, 'Lunch');
        onlineManager.setOnline(false);

        await act(() => app.groupOutbox.put(sampleEntry(group, { date: '2026-10-25' })));

        expect(rowOf('Dinner').textContent).toContain(list.pending);
    });

    it('adds your part to the subtotal of the day it was made, not of the day it is charged', async () => {
        const group = trip();
        await openHome(
            {
                expenses: [expense()],
                groups: [group],
                entries: [
                    sampleEntry(group, {
                        date: '2026-10-24',
                        payment: 'credit',
                        chargeDate: '2026-11-02',
                    }),
                ],
            },
            'Dinner'
        );

        const day = screen.getByText('Dinner').closest('section')!;
        expect(within(day).getByText('Lunch')).toBeDefined();
        expect(day.querySelector('.expense-list__subtotal')?.textContent).toBe(euros(3250));
    });

    it('gives no row for an expense you are out of, a settlement or a group whose switch is off', async () => {
        const group = trip();
        const hidden = trip({ name: 'Work', showInExpenses: false });
        await openHome(
            {
                expenses: [expense()],
                groups: [group, hidden],
                entries: [
                    sampleEntry(group, { text: 'Paid for Bea', shares: shares([bea, 4000]) }),
                    sampleSettlement(group, ana.id, bea.id, 2000),
                    sampleEntry(group, { text: 'Shown' }),
                    sampleEntry(hidden, { text: 'Hidden' }),
                ],
            },
            'Shown'
        );

        expect(rowNames()).toEqual(['Shown', 'Lunch']);
    });

    it('has nothing to open in a group that is closed', async () => {
        const group = trip({ closed: 'deleted' });
        await openHome({ groups: [group], entries: [sampleEntry(group)] }, 'Dinner');

        expect(rowOf('Dinner').querySelector('button')).toBeNull();
    });
});

describe('searching and filtering shared rows', () => {
    async function openMixed() {
        const group = trip();
        const dani = friend('Dani');
        await openHome(
            {
                expenses: [expense({ text: 'Lunch' })],
                groups: [group, dani],
                entries: [
                    sampleEntry(group, { text: 'Dinner', payment: 'credit', chargeDate: '2026-11-24' }),
                    sampleEntry(dani, { text: 'Concert', shares: shares([ana, 2000], [dani.members[1]!, 2000]) }),
                ],
            },
            'Concert'
        );
        await screen.findByText('Dinner');
    }

    it('finds a row by the name of its group, and by the person of a friend', async () => {
        await openMixed();

        search('lisbon');
        await waitFor(() => expect(rowNames()).toEqual(['Dinner']));
        search('dani');
        await waitFor(() => expect(rowNames()).toEqual(['Concert']));
    });

    it('keeps the rows of a group with Shared with, and only your own with Just me', async () => {
        await openMixed();
        openFilters();

        pickOption(f.sharedWith, 'Trip to Lisbon');
        expect(rowNames()).toEqual(['Dinner']);
        pickOption(f.sharedWith, 'Dani');
        expect(rowNames()).toEqual(['Concert']);
        pickOption(f.sharedWith, f.shared.me);
        expect(rowNames()).toEqual(['Lunch']);
    });

    it('finds your credit card row under Paid with, and the others under Now', async () => {
        await openMixed();
        openFilters();

        fireEvent.click(screen.getByRole('radio', { name: en.expenses.payment.credit }));
        expect(rowNames()).toEqual(['Dinner']);
        fireEvent.click(screen.getByRole('radio', { name: en.expenses.payment.direct }));
        expect(rowNames().toSorted()).toEqual(['Concert', 'Lunch']);
    });
});

describe('a shared row in Spanish', () => {
    it('says who paid and the total in Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const group = trip();
        await openHome(
            {
                groups: [group],
                entries: [sampleEntry(group, { text: 'Cena', paidBy: bea.id })],
            },
            'Cena'
        );

        const tEs = createTranslator({ locale: 'es', messages: es });
        expect(rowOf('Cena').textContent).toContain(
            tEs('expenses.list.paidByTotal', { name: 'Bea', total: formatAmount(4000, 'EUR', 'es') })
        );
    });
});
