import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';

import type { PendingEntry } from '@/lib/offline';
import type { GroupMember, SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups.settle;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');
const cris = person('Cris');

function expense(group: SharedGroup, payer: GroupMember, shares: Array<[GroupMember, number]>) {
    return sampleEntry(group, {
        paidBy: payer.id,
        amountCents: shares.reduce((sum, [, cents]) => sum + cents, 0),
        shares: shares.map(([member, cents]) => ({ memberId: member.id, cents })),
    });
}

function trip(overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ members: [ana, bea, cris], me: ana.id, ...overrides });
}

function debts(group: SharedGroup) {
    return [
        expense(group, bea, [
            [ana, 1500],
            [bea, 1500],
        ]),
        expense(group, ana, [
            [ana, 1000],
            [cris, 1000],
        ]),
    ];
}

async function open(group: SharedGroup, entries: PendingEntry[]) {
    const api = createFakeApi({ groups: [group], entries });
    stubApi(api.handler);
    const app = renderApp({ path: `/groups/${group.id}` });
    await screen.findByRole('heading', { name: en.groups.debts.label });
    await waitFor(() => expect(lines().length).toBeGreaterThan(0));
    return { api, app };
}

function sheet() {
    return screen.getByRole('heading', { name: en.groups.debts.label }).closest('section')!;
}

function lines() {
    return within(sheet())
        .queryAllByRole('listitem')
        .filter((line) => line.closest('.disclosure') === null)
        .map((line) => line.firstChild?.textContent);
}

function lineButton(debt: string) {
    return screen.getByRole('button', { name: t('groups.settle.lineItem', { debt }) });
}

function toggle() {
    return screen.getByRole('button', { name: text.title }) as HTMLButtonElement;
}

function select(label: string) {
    return screen.getByRole('combobox', { name: label });
}

function choose(label: string, option: string) {
    fireEvent.click(select(label));
    fireEvent.click(screen.getByRole('option', { name: option }));
}

function amount() {
    return screen.getByLabelText(text.amount) as HTMLInputElement;
}

function save() {
    return screen.getByRole('button', { name: text.save }) as HTMLButtonElement;
}

function sentences(...texts: string[]) {
    return texts.map((text) => `${text}.`).join(' ');
}

function hint() {
    return document.getElementById(amount().getAttribute('aria-describedby')!.split(' ')[0]!)!.textContent;
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('settling up from a line', () => {
    it('fills in who pays whom and how much, and puts the focus on the amount', async () => {
        const group = trip();
        await open(group, debts(group));

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));

        expect(select(text.from).textContent).toBe(text.you);
        expect(select(text.to).textContent).toBe('Bea');
        expect(amount().value).toBe('15.00');
        expect(document.activeElement).toBe(amount());
    });

    it('saves a settlement on the device, offline too, and the balances change at once', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        onlineManager.setOnline(false);

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        fireEvent.click(save());

        await waitFor(() =>
            expect(lines()).toEqual([t('groups.debts.owesYou', { name: 'Cris', amount: euros(1000) })])
        );
        expect(within(screen.getByRole('main')).getByRole('status').textContent).toBe(
            t('groups.balance.owed', { amount: euros(1000) })
        );
        expect(app.groupOutbox.getState().pending).toMatchObject([
            {
                groupId: group.id,
                kind: 'settlement',
                text: '',
                categoryId: null,
                amountCents: 1500,
                currency: 'EUR',
                paidBy: ana.id,
                split: 'exact',
                shares: [{ memberId: bea.id, cents: 1500 }],
                payment: 'direct',
                chargeDate: null,
                deletedAt: null,
            },
        ]);
        expect(screen.queryByLabelText(text.amount)).toBeNull();
        expect(document.activeElement).toBe(toggle());
    });

    it('goes back to where it starts for a person who leaves while it is open', async () => {
        const group = trip();
        const { api, app } = await open(group, debts(group));
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));

        api.groups[0]!.members.find((member) => member.id === bea.id)!.leftAt = 2;
        await act(() => app.queryClient.invalidateQueries({ queryKey: GROUPS_KEY }));

        await waitFor(() => expect(select(text.to).textContent).toBe('Cris'));
        fireEvent.click(save());

        await waitFor(() =>
            expect(app.groupOutbox.getState().pending).toMatchObject([
                { paidBy: ana.id, shares: [{ memberId: cris.id, cents: 1500 }] },
            ])
        );
    });

    it('may pay more than the debt, which turns it the other way round', async () => {
        const group = trip();
        await open(group, debts(group));

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        fireEvent.change(amount(), { target: { value: '20' } });
        fireEvent.click(save());

        await waitFor(() =>
            expect(lines()).toEqual([
                t('groups.debts.owesYou', { name: 'Bea', amount: euros(500) }),
                t('groups.debts.owesYou', { name: 'Cris', amount: euros(1000) }),
            ])
        );
    });
});

describe('the form', () => {
    it('starts on you and on the one you owe most, with no amount and the debt as a hint', async () => {
        const group = trip();
        await open(group, [
            ...debts(group),
            expense(group, cris, [
                [ana, 500],
                [cris, 500],
            ]),
        ]);

        fireEvent.click(toggle());

        expect(select(text.from).textContent).toBe(text.you);
        expect(select(text.to).textContent).toBe('Bea');
        expect(amount().value).toBe('');
        expect(hint()).toBe(sentences(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        expect(save().disabled).toBe(true);
    });

    it('lists the people who have not left, and keeps what was typed when it is closed and opened again', async () => {
        const dani = person('Dani', { leftAt: 1 });
        const group = trip({ members: [ana, bea, cris, dani] });
        await open(group, debts(group));
        fireEvent.click(toggle());

        fireEvent.click(select(text.to));
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([text.you, 'Bea', 'Cris']);
        fireEvent.click(screen.getByRole('option', { name: 'Cris' }));
        fireEvent.change(amount(), { target: { value: '3' } });
        fireEvent.click(toggle());
        fireEvent.click(toggle());

        expect(select(text.to).textContent).toBe('Cris');
        expect(amount().value).toBe('3');
    });

    it('keeps Save off until the amount is at least a cent, and while From is To, which it says', async () => {
        const group = trip();
        await open(group, debts(group));
        fireEvent.click(toggle());

        for (const value of ['0', '0,00', 'ten', '-5']) {
            fireEvent.change(amount(), { target: { value } });
            expect(save().disabled).toBe(true);
        }
        fireEvent.change(amount(), { target: { value: '0.01' } });
        expect(save().disabled).toBe(false);

        choose(text.to, text.you);

        expect(screen.getByRole('alert').textContent).toBe(text.same);
        expect(save().disabled).toBe(true);
    });

    it('says what follows from the amount typed', async () => {
        const group = trip();
        await open(group, debts(group));
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        const debt = t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) });

        expect(hint()).toBe(sentences(debt, t('groups.settle.after.youSettled', { name: 'Bea' })));
        fireEvent.change(amount(), { target: { value: '20' } });
        expect(hint()).toBe(sentences(debt, t('groups.settle.after.owesYou', { name: 'Bea', amount: euros(500) })));
        fireEvent.change(amount(), { target: { value: '10' } });
        expect(hint()).toBe(sentences(debt, t('groups.settle.after.youOwe', { name: 'Bea', amount: euros(500) })));
    });

    it('says what follows between two other people', async () => {
        const group = trip();
        await open(group, [
            expense(group, bea, [
                [bea, 700],
                [cris, 700],
            ]),
        ]);

        fireEvent.click(lineButton(t('groups.debts.owes', { from: 'Cris', to: 'Bea', amount: euros(700) })));

        expect(select(text.from).textContent).toBe('Cris');
        expect(select(text.to).textContent).toBe('Bea');
        expect(hint()).toContain(t('groups.settle.after.settled', { from: 'Cris', to: 'Bea' }));
        fireEvent.change(amount(), { target: { value: '2' } });
        expect(hint()).toContain(t('groups.settle.after.owes', { from: 'Cris', to: 'Bea', amount: euros(500) }));
    });
});

describe('where there is no settling up', () => {
    it('has none in a closed group', async () => {
        const group = trip({ closed: 'deleted' });
        await open(group, debts(group));

        expect(within(sheet()).queryAllByRole('button', { name: /^Settle up/ })).toEqual([]);
        expect(screen.queryByRole('button', { name: text.title })).toBeNull();
    });

    it('has none on a line that names someone who left', async () => {
        const dani = person('Dani', { leftAt: 1 });
        const group = trip({ members: [ana, bea, cris, dani] });
        await open(group, [
            ...debts(group),
            expense(group, ana, [
                [ana, 400],
                [dani, 400],
            ]),
        ]);

        const left = t('groups.names.left', { name: 'Dani' });
        expect(lines()).toContain(t('groups.debts.owesYou', { name: left, amount: euros(400) }));
        expect(
            screen.queryByRole('button', {
                name: t('groups.settle.lineItem', {
                    debt: t('groups.debts.owesYou', { name: left, amount: euros(400) }),
                }),
            })
        ).toBeNull();
        expect(lineButton(t('groups.debts.owesYou', { name: 'Cris', amount: euros(1000) }))).toBeDefined();
    });
});

describe('in Spanish', () => {
    it('names the button of each line by words that hold what it shows', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const group = trip();
        const api = createFakeApi({ groups: [group], entries: debts(group) });
        stubApi(api.handler);
        renderApp({ path: `/groups/${group.id}` });
        const label = await screen.findByRole('heading', { name: es.groups.debts.label });
        await waitFor(() => expect(within(label.closest('section')!).getAllByRole('button')).not.toHaveLength(1));

        const buttons = within(label.closest('section')!)
            .getAllByRole('button')
            .filter((button) => button.hasAttribute('aria-label'));
        expect(buttons).toHaveLength(2);
        for (const button of buttons) {
            expect(button.getAttribute('aria-label')!.toLowerCase()).toContain(button.textContent!.toLowerCase());
        }
    });
});
