import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { chosenOption, optionNames, pickOption } from '@/lib/test/select';
import { toDateString } from '@core/date';
import { formatAmount } from '@core/money';

import type { SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const form = en.expenses.form;
const share = en.groups.share;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');
const cris = person('Cris');

function trip(overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ name: 'Trip', members: [ana, bea, cris], me: ana.id, ...overrides });
}

function friend(name: string, overrides: Partial<SharedGroup> = {}) {
    const me = person('Ana', { role: 'owner' });
    return sampleGroup({ kind: 'direct', name: null, members: [me, person(name)], me: me.id, ...overrides });
}

async function openHome(groups: SharedGroup[]) {
    const api = createFakeApi({ groups });
    stubApi(api.handler);
    const app = renderApp();
    await screen.findByRole('radio', { name: form.forShared });
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    return { api, app };
}

function forChoice(name: string) {
    return screen.getByRole('radio', { name }) as HTMLInputElement;
}

function field(label: string) {
    return screen.getByLabelText(label) as HTMLInputElement;
}

function fill({ amount, text = '' }: { amount: string; text?: string }) {
    fireEvent.change(field(form.amount), { target: { value: amount } });
    fireEvent.change(field(form.text), { target: { value: text } });
}

function addButton() {
    return screen.getByRole('button', { name: form.submit }) as HTMLButtonElement;
}

function people() {
    return screen.getByRole('group', { name: share.people });
}

function rows() {
    return within(people())
        .getAllByRole('listitem')
        .map((row) => row.textContent);
}

function checkbox(name: string) {
    return within(people()).getByRole('checkbox', { name }) as HTMLInputElement;
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the choice For', () => {
    it('starts on Just me, and Shared asks who with, who paid and who is in', async () => {
        const group = trip();
        await openHome([group]);

        expect(forChoice(form.forMe).checked).toBe(true);
        expect(screen.queryByRole('group', { name: share.people })).toBeNull();
        fireEvent.click(forChoice(form.forShared));

        expect(chosenOption(share.with)).toBe('Trip');
        expect(chosenOption(share.paidBy)).toBe(share.you);
        expect(optionNames(share.paidBy)).toEqual([share.you, 'Bea', 'Cris']);
        expect(rows()).toEqual([share.you, 'Bea', 'Cris']);
        expect([share.you, 'Bea', 'Cris'].map((name) => checkbox(name).checked)).toEqual([true, true, true]);
    });

    it('offers the open groups first and then the friends, and none that is closed', async () => {
        await openHome([
            friend('Dani'),
            trip(),
            sampleGroup({ name: 'Old flat', closed: 'deleted' }),
            friend('Eva', { closed: 'left' }),
        ]);

        fireEvent.click(forChoice(form.forShared));

        expect(optionNames(share.with)).toEqual(['Trip', 'Dani']);
    });

    it('starts With on the group used last on this device', async () => {
        const dani = friend('Dani');
        localStorage.setItem('tarja:shared-with', dani.id);
        await openHome([trip(), dani]);

        fireEvent.click(forChoice(form.forShared));

        expect(chosenOption(share.with)).toBe('Dani');
        expect(rows()).toEqual([share.you, 'Dani']);
    });

    it('keeps the head and what was typed in the other tail when it switches', async () => {
        await openHome([trip()]);
        fill({ amount: '30', text: 'Dinner' });
        pickOption(form.installments, t('expenses.form.installmentsOption', { count: 3 }));

        fireEvent.click(forChoice(form.forShared));
        fireEvent.click(checkbox('Bea'));
        fireEvent.click(forChoice(form.forMe));

        expect(field(form.amount).value).toBe('30');
        expect(field(form.text).value).toBe('Dinner');
        expect(chosenOption(form.installments)).toBe(t('expenses.form.installmentsOption', { count: 3 }));
        fireEvent.click(forChoice(form.forShared));
        expect(checkbox('Bea').checked).toBe(false);
    });

    it('says how to share when there is no open group or friend', async () => {
        await openHome([sampleGroup({ closed: 'deleted' })]);

        fireEvent.click(forChoice(form.forShared));

        expect(screen.getByText(share.none)).toBeDefined();
        expect(screen.queryByRole('combobox', { name: share.with })).toBeNull();
        fill({ amount: '10' });
        expect(addButton().disabled).toBe(true);
    });
});

describe('splitting equally', () => {
    it('gives each person who is in the amount divided, the cents left to the first ones', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: '10' });

        expect(rows()).toEqual([`${share.you}${euros(334)}`, `Bea${euros(333)}`, `Cris${euros(333)}`]);
    });

    it('saves the expense in the group on the device, offline too, and empties the form back to Just me', async () => {
        const group = trip();
        const { app } = await openHome([group]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: '10', text: 'Dinner' });
        fireEvent.click(addButton());

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending).toEqual([
            {
                id: expect.any(String),
                groupId: group.id,
                kind: 'expense',
                text: 'Dinner',
                categoryId: 'food',
                amountCents: 1000,
                currency: 'EUR',
                date: toDateString(new Date()),
                paidBy: ana.id,
                split: 'equal',
                shares: [
                    { memberId: ana.id, cents: 334 },
                    { memberId: bea.id, cents: 333 },
                    { memberId: cris.id, cents: 333 },
                ],
                payment: 'direct',
                chargeDate: null,
                createdAt: expect.any(Number),
                updatedAt: expect.any(Number),
                deletedAt: null,
            },
        ]);
        expect(app.outbox.getState().pending).toEqual([]);
        expect(field(form.amount).value).toBe('');
        expect(field(form.text).value).toBe('');
        expect(forChoice(form.forMe).checked).toBe(true);
        expect(localStorage.getItem('tarja:shared-with')).toBe(group.id);
    });

    it('leaves out whoever is unchecked, who shows no share', async () => {
        const group = trip();
        const { app } = await openHome([group]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        fireEvent.click(checkbox('Cris'));
        fireEvent.click(addButton());

        expect(rows()).toEqual([`${share.you}${euros(500)}`, `Bea${euros(500)}`, 'Cris']);
        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]!.shares).toEqual([
            { memberId: ana.id, cents: 500 },
            { memberId: bea.id, cents: 500 },
        ]);
    });

    it('records that somebody else paid, the person left out of it', async () => {
        const group = trip();
        const { app } = await openHome([group]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        pickOption(share.paidBy, 'Bea');
        fireEvent.click(checkbox(share.you));
        fireEvent.click(addButton());

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]).toMatchObject({
            paidBy: bea.id,
            shares: [
                { memberId: bea.id, cents: 500 },
                { memberId: cris.id, cents: 500 },
            ],
        });
    });

    it('keeps Add off and says so while nobody is in', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        for (const name of [share.you, 'Bea', 'Cris']) fireEvent.click(checkbox(name));

        expect(screen.getByRole('alert').textContent).toBe(share.nobody);
        expect(addButton().disabled).toBe(true);
    });

    it('keeps Add off while the amount is not one', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: 'ten' });

        expect(addButton().disabled).toBe(true);
    });

    it('offers neither as payer nor among the people a member who left or was merged', async () => {
        const gone = person('Gus', { leftAt: 1 });
        const dummy = person('Bruno', { claimed: false, leftAt: 1, mergedInto: bea.id });
        await openHome([trip({ members: [ana, bea, gone, dummy, cris] })]);

        fireEvent.click(forChoice(form.forShared));

        expect(rows()).toEqual([share.you, 'Bea', 'Cris']);
        expect(optionNames(share.paidBy)).toEqual([share.you, 'Bea', 'Cris']);
    });
});

describe('saving', () => {
    it('saves once on a double tap', async () => {
        const { app } = await openHome([trip()]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        fireEvent.click(addButton());
        fireEvent.click(addButton());

        await waitFor(() => expect(field(form.amount).value).toBe(''));
        expect(app.groupOutbox.getState().pending).toHaveLength(1);
    });

    it('keeps the form and says so when the device cannot keep the expense', async () => {
        const { app } = await openHome([trip()]);
        vi.spyOn(app.groupOutbox, 'put').mockRejectedValueOnce(new Error('Storage is full'));
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10', text: 'Dinner' });

        fireEvent.click(addButton());

        expect((await screen.findByRole('alert')).textContent).toBe(form.saveFailed);
        expect(field(form.amount).value).toBe('10');
        expect(forChoice(form.forShared).checked).toBe(true);
        expect(addButton().disabled).toBe(false);
    });
});
