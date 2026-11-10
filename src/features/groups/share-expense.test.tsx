import { onlineManager } from '@tanstack/react-query';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { CATEGORIES_KEY, GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { rememberSharedWith } from '@/lib/offline';
import { randomSeed } from '@/lib/random-seed';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER, createFakeAuth } from '@/lib/test/fake-auth';
import { seedFavouring } from '@/lib/test/favouring-seed';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { chosenOption, optionNames, pickOption } from '@/lib/test/select';
import { openAddSheet } from '@/lib/test/sheet';
import { addMonths, toDateString } from '@core/date';
import { formatAmount } from '@core/money';

import type { SharedGroup } from '@core/shared-group';

vi.mock('@/lib/random-seed', () => ({ randomSeed: vi.fn() }));

const t = createTranslator({ locale: 'en', messages: en });
const form = en.expenses.form;
const share = en.groups.share;
const you = t('groups.names.you', { name: 'Ana' });

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
    await screen.findByRole('button', { name: en.nav.add });
    await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
    await waitFor(() => expect(app.queryClient.getQueryState(CATEGORIES_KEY)?.status).toBe('success'));
    await openAddSheet();
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

function amountsShown() {
    return rows().map((text) => {
        const amount = /\d[\d,.]*$/.exec(text ?? '')?.[0] ?? '0';
        return Math.round(Number(amount.replace(/,/g, '')) * 100);
    });
}

beforeEach(() => {
    vi.mocked(randomSeed).mockReturnValue(seedFavouring(0));
});

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
    vi.mocked(randomSeed).mockReset();
});

describe('the choice For', () => {
    it('starts on Just me, and Shared asks who with, who paid and who is in', async () => {
        const group = trip();
        await openHome([group]);

        expect(forChoice(form.forMe).checked).toBe(true);
        expect(screen.queryByRole('group', { name: share.people })).toBeNull();
        fireEvent.click(forChoice(form.forShared));

        expect(chosenOption(share.with)).toBe('Trip');
        expect(chosenOption(share.paidBy)).toBe(you);
        expect(optionNames(share.paidBy)).toEqual([you, 'Bea', 'Cris']);
        expect(rows()).toEqual([you, 'Bea', 'Cris']);
        expect([you, 'Bea', 'Cris'].map((name) => checkbox(name).checked)).toEqual([true, true, true]);
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

    it('starts With on the first group for another user of the device, who never shared with the last one', async () => {
        const dani = friend('Dani');
        rememberSharedWith(TEST_USER.id, dani.id);
        stubApi(createFakeApi({ groups: [trip(), dani] }).handler);
        const other = { id: 'user-bea', name: 'Bea', email: 'bea@example.com' };
        const app = renderApp({ fakeAuth: createFakeAuth({ session: other }) });
        await screen.findByRole('button', { name: en.nav.add });
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
        await openAddSheet();

        fireEvent.click(forChoice(form.forShared));

        expect(chosenOption(share.with)).toBe('Trip');
        expect(localStorage.getItem(`tarja:shared-with:${other.id}`)).toBeNull();
    });

    it('starts With on the group used last on this device', async () => {
        const dani = friend('Dani');
        localStorage.setItem(`tarja:shared-with:${TEST_USER.id}`, dani.id);
        await openHome([trip(), dani]);

        fireEvent.click(forChoice(form.forShared));

        expect(chosenOption(share.with)).toBe('Dani');
        expect(rows()).toEqual([you, 'Dani']);
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
    it('gives each person who is in the amount divided, the cent left to the one the seed picks', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: '10' });

        expect(rows()).toEqual([`${you}${euros(334)}`, `Bea${euros(333)}`, `Cris${euros(333)}`]);
        expect(amountsShown()).toEqual([334, 333, 333]);
    });

    it('shows no amount for somebody who is in but whose part comes to nothing', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: '0.01' });

        expect(rows()).toEqual([`${you}${euros(1)}`, 'Bea', 'Cris']);
        expect([you, 'Bea', 'Cris'].map((name) => checkbox(name).checked)).toEqual([true, true, true]);
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
        await openAddSheet();
        expect(field(form.amount).value).toBe('');
        expect(field(form.text).value).toBe('');
        expect(forChoice(form.forMe).checked).toBe(true);
        expect(localStorage.getItem(`tarja:shared-with:${TEST_USER.id}`)).toBe(group.id);
    });

    it('leaves out whoever is unchecked, who shows no share', async () => {
        const group = trip();
        const { app } = await openHome([group]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        fireEvent.click(checkbox('Cris'));
        fireEvent.click(addButton());

        expect(rows()).toEqual([`${you}${euros(500)}`, `Bea${euros(500)}`, 'Cris']);
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
        fireEvent.click(checkbox(you));
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

        for (const name of [you, 'Bea', 'Cris']) fireEvent.click(checkbox(name));

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

        expect(rows()).toEqual([you, 'Bea', 'Cris']);
        expect(optionNames(share.paidBy)).toEqual([you, 'Bea', 'Cris']);
    });
});

describe('the cents left of an equal split', () => {
    it.each([
        ['Ana', 0],
        ['Bea', 1],
        ['Cris', 2],
    ])('go to %s when the seed of the form picks them', async (_name, index) => {
        vi.mocked(randomSeed).mockReturnValue(seedFavouring(index));
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: '10' });

        expect(amountsShown()).toEqual([0, 1, 2].map((position) => (position === index ? 334 : 333)));
    });

    it('stay on the same person as the form renders again and the amount and the description are typed', async () => {
        vi.mocked(randomSeed).mockReturnValue(seedFavouring(1));
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: '10' });
        const first = rows();
        fill({ amount: '10', text: 'Dinner' });
        fireEvent.change(field(form.text), { target: { value: 'Dinner with all' } });

        expect(rows()).toEqual(first);
        expect(amountsShown()).toEqual([333, 334, 333]);
        fill({ amount: '10.01', text: 'Dinner with all' });
        expect(amountsShown()[1]).toBe(334);
        expect(amountsShown().toSorted()).toEqual([333, 334, 334]);
        fill({ amount: '10', text: 'Dinner with all' });
        expect(amountsShown()).toEqual([333, 334, 333]);
        expect(randomSeed).toHaveBeenCalledTimes(1);
    });

    it('can land on different people in different forms', async () => {
        const lucky = new Set<number>();

        for (const index of [0, 1, 2]) {
            vi.mocked(randomSeed).mockReturnValue(seedFavouring(index));
            await openHome([trip()]);
            fireEvent.click(forChoice(form.forShared));
            fill({ amount: '10' });
            lucky.add(amountsShown().indexOf(334));
            cleanup();
        }

        expect([...lucky].toSorted()).toEqual([0, 1, 2]);
    });

    it('are saved on the person the form showed, and a new form draws its own seed', async () => {
        vi.mocked(randomSeed)
            .mockReturnValueOnce(seedFavouring(2))
            .mockReturnValueOnce(seedFavouring(0))
            .mockReturnValueOnce(seedFavouring(1));
        const { app } = await openHome([trip()]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        expect(amountsShown()).toEqual([333, 333, 334]);

        fireEvent.click(addButton());

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]!.shares).toEqual([
            { memberId: ana.id, cents: 333 },
            { memberId: bea.id, cents: 333 },
            { memberId: cris.id, cents: 334 },
        ]);
        await waitFor(() => expect(field(form.amount).value).toBe(''));
        await openAddSheet();
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        expect(amountsShown()).toEqual([333, 334, 333]);
    });

    it('stay on the same person when the mode changes from Equally to Percent and to Amounts', async () => {
        vi.mocked(randomSeed).mockReturnValue(seedFavouring(2));
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        pickMode('percent');
        expect(shareValues()).toEqual(['33.33', '33.33', '33.34']);
        pickMode('exact');
        expect(shareValues()).toEqual(['3.33', '3.33', '3.34']);
        pickMode('equal');
        expect(amountsShown()).toEqual([333, 333, 334]);
    });
});

describe("naming the person in Paid by and Who's in", () => {
    it('lists them as their name and (You), with the label of their share the same', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        expect(you).toBe('Ana (You)');
        expect(optionNames(share.paidBy)).toEqual([you, 'Bea', 'Cris']);
        expect(rows().map((row) => row?.replace(/[\d.]+$/, '').replace('€', ''))).toEqual([you, 'Bea', 'Cris']);
        pickMode('percent');
        expect(shareField(you, 'percentOf')).toBeDefined();
        pickMode('exact');
        expect(shareField(you, 'amountOf')).toBeDefined();
    });

    it('numbers the name when another member has the same one', async () => {
        const first = person('Ana', { role: 'owner' });
        const second = person('Ana');
        await openHome([trip({ members: [first, second, cris], me: second.id })]);
        fireEvent.click(forChoice(form.forShared));

        expect(optionNames(share.paidBy)).toEqual(['Ana', 'Ana (2) (You)', 'Cris']);
        expect(chosenOption(share.paidBy)).toBe('Ana (2) (You)');
        expect(checkbox('Ana (2) (You)').checked).toBe(true);
    });

    it('lists them as their name and (Tú) in Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const api = createFakeApi({ groups: [trip()] });
        stubApi(api.handler);
        const spanish = renderApp();
        await screen.findByRole('button', { name: es.nav.add });
        await waitFor(() => expect(spanish.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
        fireEvent.click(screen.getByRole('button', { name: es.nav.add }));
        await screen.findByRole('radio', { name: es.expenses.form.forShared });
        fireEvent.click(screen.getByRole('radio', { name: es.expenses.form.forShared }));

        expect(chosenOption(es.groups.share.paidBy)).toBe('Ana (Tú)');
        expect(optionNames(es.groups.share.paidBy)).toEqual(['Ana (Tú)', 'Bea', 'Cris']);
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

        fireEvent.change(shareField(you, 'percentOf'), { target: { value: '45' } });
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
        await screen.findByRole('button', { name: es.nav.add });
        await waitFor(() => expect(spanish.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
        fireEvent.click(screen.getByRole('button', { name: es.nav.add }));
        await screen.findByRole('radio', { name: es.expenses.form.forShared });
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
        fireEvent.change(shareField(you, 'amountOf'), { target: { value: '5' } });
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

        expect(rows()).toEqual([`${you}${euros(500)}`, 'Bea', `Cris${euros(500)}`]);
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
        pickOption(share.paidBy, you);
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

        fireEvent.click(checkbox(you));

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
    it('starts the expense from the plus shared in the group, paid by you with everybody in', async () => {
        await openGroup(trip());

        await openAddSheet();

        expect(forChoice(form.forShared).checked).toBe(true);
        expect(chosenOption(share.with)).toBe('Trip');
        expect(chosenOption(share.paidBy)).toBe(you);
        expect(rows()).toEqual([you, 'Bea', 'Cris']);
    });

    it('adds the expense to the group, offline too, and the balances change at once', async () => {
        const group = trip();
        const { app } = await openGroup(group);
        expect(balance()).toBe(en.groups.balance.allSettled);
        onlineManager.setOnline(false);
        await openAddSheet();

        fill({ amount: '30', text: 'Dinner' });
        fireEvent.click(addButton());

        await waitFor(() => expect(balance()).toBe(t('groups.balance.owed', { amount: euros(2000) })));
        expect(app.groupOutbox.getState().pending).toMatchObject([{ groupId: group.id, amountCents: 3000 }]);
        await openAddSheet();
        expect(field(form.amount).value).toBe('');
        expect(chosenOption(share.paidBy)).toBe(you);
    });

    it.each([
        ['deleted', 'deleted'],
        ['the person left', 'left'],
    ] as const)('offers no form in a group that is closed because it was %s', async (_, closed) => {
        await openGroup(trip({ closed }));

        expect(within(screen.getByRole('main')).queryByRole('button', { name: form.title })).toBeNull();
        expect(screen.queryByRole('form', { name: form.title })).toBeNull();
    });

    it('sends an expense again once when its answer was lost, and the group has it once', async () => {
        const group = trip();
        const { api, app } = await openGroup(group);
        api.state.loseEntryAnswers = true;
        await openAddSheet();

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

describe('making a friend from the form', () => {
    it('is not offered: With lists only the groups and friends there are', async () => {
        await openHome([trip(), friend('Dani')]);
        fireEvent.click(forChoice(form.forShared));

        expect(optionNames(share.with)).toEqual(['Trip', 'Dani']);
        expect(screen.queryByLabelText(/their name/i)).toBeNull();
        expect(screen.queryByRole('button', { name: /add the friend/i })).toBeNull();
    });

    it('is not offered either with no group or friend yet, where the hint says where to make one', async () => {
        await openHome([]);
        fireEvent.click(forChoice(form.forShared));

        expect(screen.getByText(share.none)).toBeDefined();
        expect(share.none).toContain(en.groups.title);
        expect(screen.queryByRole('combobox', { name: share.with })).toBeNull();
        expect(screen.queryByLabelText(/their name/i)).toBeNull();
        expect(screen.queryByRole('button', { name: /add the friend/i })).toBeNull();
        fill({ amount: '10' });
        expect(addButton().disabled).toBe(true);
    });
});

describe('the sync of a shared expense added at home', () => {
    const entryRequests = (api: { requests: string[] }, group: SharedGroup) =>
        api.requests.filter((request) => request.includes(`/api/groups/${group.id}/entries`));

    it('sends it once the connection is back, with no screen of groups opened', async () => {
        const group = trip();
        const { api, app } = await openHome([group]);
        onlineManager.setOnline(false);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '30', text: 'Dinner' });
        fireEvent.click(addButton());
        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));

        onlineManager.setOnline(true);

        await waitFor(() => expect(app.groupOutbox.getState().pending).toEqual([]));
        expect(api.entryWrites).toMatchObject([{ text: 'Dinner', amountCents: 3000 }]);
    });

    it('asks for no ledger of a group whose switch is off, and still sends a write to it', async () => {
        const hidden = trip({ showInExpenses: false });
        const shown = friend('Dani');
        const { api, app } = await openHome([hidden, shown]);
        await waitFor(() => expect(entryRequests(api, shown)).toEqual([`GET /api/groups/${shown.id}/entries?after=0`]));
        expect(entryRequests(api, hidden)).toEqual([]);
        fireEvent.click(forChoice(form.forShared));
        pickOption(share.with, 'Trip');

        fill({ amount: '30', text: 'Dinner' });
        fireEvent.click(addButton());

        await waitFor(() => expect(api.entryWrites).toMatchObject([{ text: 'Dinner' }]));
        await waitFor(() => expect(app.groupOutbox.getState().pending).toEqual([]));
        expect(entryRequests(api, hidden)[0]).toMatch(/^PUT /);
    });

    it('tries it again every 30 s from home after the connection dropped', async () => {
        const { api, app } = await openHome([trip()]);
        api.state.offline = true;
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '30', text: 'Dinner' });
        fireEvent.click(addButton());
        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));

        api.state.offline = false;
        await act(() => vi.advanceTimersByTimeAsync(30_000));

        await vi.waitFor(() => expect(app.groupOutbox.getState().pending).toEqual([]));
        expect(api.entryWrites).toMatchObject([{ text: 'Dinner' }]);
        vi.useRealTimers();
    });
});
