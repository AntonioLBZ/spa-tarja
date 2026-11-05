import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
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

function theForm() {
    return screen.getByRole('form', { name: form.title });
}

function shareField(name: string, kind: 'percentOf' | 'amountOf') {
    return within(people()).getByRole('textbox', { name: t(`groups.share.${kind}`, { name }) }) as HTMLInputElement;
}

function shareValues() {
    return within(people())
        .queryAllByRole('textbox')
        .map((input) => (input as HTMLInputElement).value);
}

function pickMode(mode: 'equal' | 'percent' | 'exact') {
    fireEvent.click(screen.getByRole('radio', { name: share.modes[mode] }));
}

function percent(basisPoints: number, locale = 'en') {
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(basisPoints / 10_000);
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

describe('splitting by percent', () => {
    it('starts from 100 split evenly to two decimals, and saves parts that add up to the amount', async () => {
        const group = trip();
        const { app } = await openHome([group]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        pickMode('percent');

        expect(shareValues()).toEqual(['33.34', '33.33', '33.33']);
        fireEvent.click(addButton());
        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]).toMatchObject({
            amountCents: 1000,
            split: 'percent',
            shares: [
                { memberId: ana.id, cents: 334 },
                { memberId: bea.id, cents: 333 },
                { memberId: cris.id, cents: 333 },
            ],
        });
    });

    it('rounds each part down and gives the cents left to the biggest fractions', async () => {
        const { app } = await openHome([trip()]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '0.10' });
        pickMode('percent');

        fireEvent.change(shareField(share.you, 'percentOf'), { target: { value: '45' } });
        fireEvent.change(shareField('Bea', 'percentOf'), { target: { value: '45' } });
        fireEvent.change(shareField('Cris', 'percentOf'), { target: { value: '10' } });
        fireEvent.click(addButton());

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]!.shares).toEqual([
            { memberId: ana.id, cents: 5 },
            { memberId: bea.id, cents: 4 },
            { memberId: cris.id, cents: 1 },
        ]);
    });

    it('says what is left or over, and keeps Add off until it adds up to 100', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickMode('percent');

        fireEvent.change(shareField('Cris', 'percentOf'), { target: { value: '30.83' } });
        expect(within(theForm()).getByRole('status').textContent).toBe(
            t('groups.share.percentLeft', { percent: percent(250) })
        );
        expect(addButton().disabled).toBe(true);

        fireEvent.change(shareField('Cris', 'percentOf'), { target: { value: '40' } });
        expect(screen.getByRole('alert').textContent).toBe(t('groups.share.percentOver', { percent: percent(667) }));
        expect(addButton().disabled).toBe(true);

        fireEvent.change(shareField('Cris', 'percentOf'), { target: { value: '33.33' } });
        expect(screen.queryByRole('alert')).toBeNull();
        expect(addButton().disabled).toBe(false);
    });

    it('says so when a percentage is not one from 0 to 100', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickMode('percent');

        fireEvent.change(shareField('Bea', 'percentOf'), { target: { value: '33.333' } });

        expect(screen.getByRole('alert').textContent).toBe(share.percentInvalid);
        expect(shareField('Bea', 'percentOf').getAttribute('aria-invalid')).toBe('true');
        expect(addButton().disabled).toBe(true);
    });

    it('reads the percentages with the decimal comma of Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const tEs = createTranslator({ locale: 'es', messages: es });
        const api = createFakeApi({ groups: [trip()] });
        stubApi(api.handler);
        const spanish = renderApp();
        await screen.findByRole('radio', { name: es.expenses.form.forShared });
        await waitFor(() => expect(spanish.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
        fireEvent.click(screen.getByRole('radio', { name: es.expenses.form.forShared }));
        fireEvent.change(screen.getByLabelText(es.expenses.form.amount), { target: { value: '10' } });
        fireEvent.click(screen.getByRole('radio', { name: es.groups.share.modes.percent }));

        const fields = within(screen.getByRole('group', { name: es.groups.share.people })).getAllByRole('textbox');
        expect(fields.map((input) => (input as HTMLInputElement).value)).toEqual(['33,34', '33,33', '33,33']);
        fireEvent.change(fields[0]!, { target: { value: '50,5' } });
        expect(screen.getByRole('alert').textContent).toBe(
            tEs('groups.share.percentOver', { percent: percent(1716, 'es') })
        );
    });

    it('keeps who is in, and starts again among them when somebody is left out', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        fireEvent.click(checkbox('Cris'));

        pickMode('percent');
        expect(shareValues()).toEqual(['50.00', '50.00']);
        fireEvent.change(shareField('Bea', 'percentOf'), { target: { value: '30' } });
        fireEvent.click(checkbox('Cris'));

        expect(shareValues()).toEqual(['33.34', '33.33', '33.33']);
    });
});

describe('splitting by amount', () => {
    it('starts from the equal split and saves the amounts typed', async () => {
        const { app } = await openHome([trip()]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        pickMode('exact');
        expect(shareValues()).toEqual(['3.34', '3.33', '3.33']);
        fireEvent.change(shareField(share.you, 'amountOf'), { target: { value: '5' } });
        fireEvent.change(shareField('Bea', 'amountOf'), { target: { value: '5' } });
        fireEvent.change(shareField('Cris', 'amountOf'), { target: { value: '0' } });
        fireEvent.click(addButton());

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]).toMatchObject({
            split: 'exact',
            shares: [
                { memberId: ana.id, cents: 500 },
                { memberId: bea.id, cents: 500 },
            ],
        });
    });

    it('says what is unassigned or over, and keeps Add off until it adds up', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickMode('exact');

        fireEvent.change(shareField('Cris', 'amountOf'), { target: { value: '1' } });
        expect(within(theForm()).getByRole('status').textContent).toBe(
            t('groups.share.unassigned', { amount: euros(233) })
        );
        expect(addButton().disabled).toBe(true);

        fireEvent.change(shareField('Cris', 'amountOf'), { target: { value: '4.83' } });
        expect(screen.getByRole('alert').textContent).toBe(t('groups.share.over', { amount: euros(150) }));
        expect(addButton().disabled).toBe(true);

        fireEvent.change(shareField('Cris', 'amountOf'), { target: { value: 'x' } });
        expect(screen.getByRole('alert').textContent).toBe(share.amountInvalid);
        expect(addButton().disabled).toBe(true);
    });

    it('keeps who is in when the mode changes back to equal', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        fireEvent.click(checkbox('Bea'));
        pickMode('exact');

        pickMode('equal');

        expect(rows()).toEqual([`${share.you}${euros(500)}`, 'Bea', `Cris${euros(500)}`]);
    });
});
