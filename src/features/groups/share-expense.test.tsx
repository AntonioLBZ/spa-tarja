import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { CATEGORIES_KEY, GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { chosenOption, optionNames, pickOption } from '@/lib/test/select';
import { addMonths, toDateString } from '@core/date';
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

async function openHome(groups: SharedGroup[], options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi({ groups, ...options });
    stubApi(api.handler);
    const app = renderApp();
    await screen.findByRole('radio', { name: form.forShared });
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    await waitFor(() => expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success'));
    return { api, app };
}

async function openGroup(group: SharedGroup) {
    const api = createFakeApi({ groups: [group] });
    stubApi(api.handler);
    const app = renderApp({ path: `/groups/${group.id}` });
    await screen.findByRole('heading', { name: 'Trip' });
    await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(group.id))?.status).toBe('success'));
    return { api, app };
}

function balance() {
    return within(screen.getByRole('main')).getByRole('status').textContent;
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

        expect(optionNames(share.with)).toEqual(['Trip', 'Dani', share.newPerson]);
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

    it('shows no amount for somebody who is in but whose part comes to nothing', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: '0.01' });

        expect(rows()).toEqual([`${share.you}${euros(1)}`, 'Bea', 'Cris']);
        expect([share.you, 'Bea', 'Cris'].map((name) => checkbox(name).checked)).toEqual([true, true, true]);
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

describe('how you paid', () => {
    const today = () => toDateString(new Date());

    it('is asked while you pay, and a card saves the day it is charged', async () => {
        const { app } = await openHome([trip()]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        expect(chosenOption(share.howYouPaid)).toBe(en.expenses.payment.direct);
        expect(screen.getByText(share.othersNow)).toBeDefined();
        pickOption(share.howYouPaid, en.expenses.payment.credit);
        expect(field(form.chargeDate).value).toBe(addMonths(today(), 1));
        fireEvent.click(addButton());

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]).toMatchObject({
            paidBy: ana.id,
            payment: 'credit',
            chargeDate: addMonths(today(), 1),
        });
    });

    it('is left out when somebody else pays, and is back to Now when you do again', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        pickOption(share.howYouPaid, en.expenses.payment.voucher);

        pickOption(share.paidBy, 'Bea');

        expect(screen.queryByRole('combobox', { name: share.howYouPaid })).toBeNull();
        expect(screen.queryByLabelText(form.chargeDate)).toBeNull();
        pickOption(share.paidBy, share.you);
        expect(chosenOption(share.howYouPaid)).toBe(en.expenses.payment.direct);
    });

    it('never sends a card for somebody else, whatever Just me holds', async () => {
        const { app } = await openHome([trip()]);
        onlineManager.setOnline(false);
        fill({ amount: '10' });
        fireEvent.click(forChoice(form.forShared));
        pickOption(share.paidBy, 'Bea');
        fireEvent.click(forChoice(form.forMe));
        pickOption(form.payment, en.expenses.payment.credit);
        fireEvent.click(forChoice(form.forShared));

        fireEvent.click(addButton());

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]).toMatchObject({
            paidBy: bea.id,
            payment: 'direct',
            chargeDate: null,
        });
    });

    it.each([
        ['a credit card', 'credit'],
        ['a restaurant card', 'voucher'],
    ] as const)('needs you in the split to pay with %s', async (_, payment) => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickOption(share.howYouPaid, en.expenses.payment[payment]);

        fireEvent.click(checkbox(share.you));

        expect(within(theForm()).getByRole('alert').textContent).toBe(share.cardNeedsYou);
        expect(addButton().disabled).toBe(true);
    });

    it('refuses a charge before the day of the expense, as for an expense of one person', async () => {
        const { app } = await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickOption(share.howYouPaid, en.expenses.payment.credit);

        fireEvent.change(field(form.chargeDate), { target: { value: addMonths(today(), -1) } });
        fireEvent.click(addButton());

        expect((await screen.findByRole('alert')).textContent).toBe(form.chargeDateInvalid);
        expect(app.groupOutbox.getState().pending).toEqual([]);
    });
});

describe('the category of a shared expense', () => {
    const kids = { id: crypto.randomUUID(), name: 'Kids', color: 'blue', icon: 'child_care' } as const;

    it('is one of the default ones only', async () => {
        await openHome([trip()], { categories: [kids] });

        expect(optionNames(form.category)).toEqual([...Object.values(en.categories), 'Kids']);
        fireEvent.click(forChoice(form.forShared));
        expect(optionNames(form.category)).toEqual(Object.values(en.categories));
    });

    it('takes the place of a custom one with the suggestion, says why, and gives it back to Just me', async () => {
        const { app } = await openHome([trip()], { categories: [kids] });
        onlineManager.setOnline(false);
        fill({ amount: '10', text: 'Dinner' });
        pickOption(form.category, 'Kids');

        fireEvent.click(forChoice(form.forShared));

        expect(chosenOption(form.category)).toBe(en.categories.food);
        expect(screen.getByText(form.customShared)).toBeDefined();
        fireEvent.click(forChoice(form.forMe));
        expect(chosenOption(form.category)).toBe('Kids');
        fireEvent.click(forChoice(form.forShared));
        fireEvent.click(addButton());
        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]!.categoryId).toBe('food');
    });

    it('is Other in place of a custom one when the description suggests nothing', async () => {
        await openHome([trip()], { categories: [kids] });
        pickOption(form.category, 'Kids');

        fireEvent.click(forChoice(form.forShared));

        expect(chosenOption(form.category)).toBe(en.categories.other);
    });

    it('is still suggested from the description', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: '10', text: 'Dinner' });

        expect(chosenOption(form.category)).toBe(en.categories.food);
        expect(screen.getByText(form.suggested)).toBeDefined();
    });
});

describe('on the screen of a group', () => {
    it('has the form collapsed under its heading, shared in the group with nothing to choose', async () => {
        await openGroup(trip());
        const toggle = screen.getByRole('button', { name: form.title });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(toggle);

        expect(screen.queryByRole('radio', { name: form.forShared })).toBeNull();
        expect(screen.queryByRole('combobox', { name: share.with })).toBeNull();
        expect(chosenOption(share.paidBy)).toBe(share.you);
        expect(rows()).toEqual([share.you, 'Bea', 'Cris']);
    });

    it('adds the expense to the group, offline too, and the balances change at once', async () => {
        const group = trip();
        const { app } = await openGroup(group);
        expect(balance()).toBe(en.groups.balance.allSettled);
        onlineManager.setOnline(false);
        fireEvent.click(screen.getByRole('button', { name: form.title }));

        fill({ amount: '30', text: 'Dinner' });
        fireEvent.click(addButton());

        await waitFor(() => expect(balance()).toBe(t('groups.balance.owed', { amount: euros(2000) })));
        expect(app.groupOutbox.getState().pending).toMatchObject([{ groupId: group.id, amountCents: 3000 }]);
        expect(field(form.amount).value).toBe('');
        expect(chosenOption(share.paidBy)).toBe(share.you);
    });

    it.each([
        ['deleted', 'deleted'],
        ['the person left', 'left'],
    ] as const)('offers no form in a group that is closed because it was %s', async (_, closed) => {
        await openGroup(trip({ closed }));

        expect(screen.queryByRole('button', { name: form.title })).toBeNull();
        expect(screen.queryByRole('form', { name: form.title })).toBeNull();
    });

    it('sends an expense again once when its answer was lost, and the group has it once', async () => {
        const group = trip();
        const { api, app } = await openGroup(group);
        api.state.loseEntryAnswers = true;
        fireEvent.click(screen.getByRole('button', { name: form.title }));

        fill({ amount: '30', text: 'Dinner' });
        fireEvent.click(addButton());
        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(app.groupOutbox.getState().pending).toHaveLength(1);
        api.state.loseEntryAnswers = false;
        await act(() => app.queryClient.invalidateQueries({ queryKey: groupEntriesKey(group.id) }));

        await waitFor(() => expect(app.groupOutbox.getState().pending).toEqual([]));
        expect(api.entriesOf(group.id)).toHaveLength(1);
        expect(new Set(api.entryAttempts.map((entry) => entry.id)).size).toBe(1);
        expect(balance()).toBe(t('groups.balance.owed', { amount: euros(2000) }));
    });
});

describe('a group that closes while the form is open', () => {
    it('keeps the expense off the device and says why', async () => {
        const group = trip();
        const { app } = await openHome([group]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        app.queryClient.setQueryData(GROUPS_KEY, [{ ...group, closed: 'deleted' }]);
        fireEvent.click(addButton());

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.readOnly);
        expect(app.groupOutbox.getState().pending).toEqual([]);
        await waitFor(() => expect(screen.getByText(share.none)).toBeDefined());
    });
});

describe('New person…', () => {
    it('makes a friend by name on the spot and shares the expense with them', async () => {
        const { api, app } = await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        pickOption(share.with, share.newPerson);
        expect(addButton().disabled).toBe(true);
        fireEvent.change(field(en.groups.friend.name), { target: { value: 'Dani' } });
        fireEvent.click(screen.getByRole('button', { name: en.groups.friend.submit }));

        await waitFor(() => expect(chosenOption(share.with)).toBe('Dani'));
        expect(rows()).toEqual([`${share.you}${euros(500)}`, `Dani${euros(500)}`]);
        const dani = api.groups.find((group) => group.kind === 'direct')!;
        onlineManager.setOnline(false);
        fireEvent.click(addButton());
        await waitFor(() => expect(app.groupOutbox.getState().pending).toMatchObject([{ groupId: dani.id }]));
    });

    it('makes the friend with Enter in the name, and adds no expense', async () => {
        const { api, app } = await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickOption(share.with, share.newPerson);

        fireEvent.change(field(en.groups.friend.name), { target: { value: 'Dani' } });
        fireEvent.keyDown(field(en.groups.friend.name), { key: 'Enter' });

        await waitFor(() => expect(chosenOption(share.with)).toBe('Dani'));
        expect(api.groups.filter((group) => group.kind === 'direct')).toHaveLength(1);
        expect(app.groupOutbox.getState().pending).toEqual([]);
    });

    it('refuses a name with nothing that shows before sending it', async () => {
        const { api } = await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        pickOption(share.with, share.newPerson);

        fireEvent.change(field(en.groups.friend.name), { target: { value: '   ' } });
        fireEvent.click(screen.getByRole('button', { name: en.groups.friend.submit }));

        expect(within(theForm()).getByRole('alert').textContent).toBe(en.groups.nameInvalid);
        expect(api.groupRequests).toEqual([]);
    });

    it('is off offline and says why, while the groups on the device still work', async () => {
        await openHome([trip()]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));

        pickOption(share.with, share.newPerson);

        expect(field(en.groups.friend.name).disabled).toBe(true);
        expect((screen.getByRole('button', { name: en.groups.friend.submit }) as HTMLButtonElement).disabled).toBe(
            true
        );
        expect(screen.getByText(share.newPersonOffline)).toBeDefined();
        pickOption(share.with, 'Trip');
        expect(rows()).toEqual([share.you, 'Bea', 'Cris']);
    });

    it('is there under the hint when there is no group or friend yet', async () => {
        await openHome([]);
        fireEvent.click(forChoice(form.forShared));

        fireEvent.change(field(en.groups.friend.name), { target: { value: 'Dani' } });
        fireEvent.click(screen.getByRole('button', { name: en.groups.friend.submit }));

        await waitFor(() => expect(chosenOption(share.with)).toBe('Dani'));
        expect(screen.queryByText(share.none)).toBeNull();
    });
});
