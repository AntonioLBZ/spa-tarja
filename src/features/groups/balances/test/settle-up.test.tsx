import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person, sampleEntry, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { chosenOption, optionNames, pickOption } from '@/lib/testing/select';
import { spokenText } from '@/lib/testing/spoken-text';
import { toDateString } from '@core/basics/date';
import { formatAmount } from '@core/basics/money';

import type { PendingEntry } from '@/lib/offline';
import type { GroupMember, SharedGroup } from '@core/groups/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups.settle;
const you = t('groups.names.you', { name: 'Ana' });

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

function spokenStatus() {
    return within(screen.getByRole('main'))
        .getAllByRole('status')
        .find((region) => region.textContent !== '');
}

function sheet() {
    return screen.getByRole('heading', { name: en.groups.debts.label }).closest('section')!;
}

function lines() {
    for (const toggle of within(sheet()).queryAllByRole('button')) {
        if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
    }
    const sentences = [...sheet().querySelectorAll('.group-balances__debt > .visually-hidden')].map(
        (sentence) => sentence.textContent
    );
    return [...new Set(sentences)];
}

function lineButton(debt: string) {
    return screen.getAllByRole('button', { name: t('groups.settle.lineItem', { debt }) })[0]!;
}

function toggle() {
    return screen.getByRole('button', { name: text.open }) as HTMLButtonElement;
}

function settleUp() {
    return screen.getByRole('dialog') as HTMLElement;
}

function closeSheet() {
    act(() => settleUp().dispatchEvent(new Event('cancel', { cancelable: true })));
    act(() => (settleUp() as HTMLDialogElement).close());
}

function choose(label: string, option: string) {
    pickOption(label, option);
}

function amount() {
    return within(settleUp()).getByLabelText(text.amount) as HTMLInputElement;
}

function date() {
    return within(settleUp()).getByLabelText(text.date) as HTMLInputElement;
}

function save() {
    return screen.getByRole('button', { name: text.save }) as HTMLButtonElement;
}

function problemOf(field: HTMLElement) {
    return field
        .getAttribute('aria-describedby')
        ?.split(' ')
        .map((id) => document.getElementById(id))
        .find((element) => element?.getAttribute('role') === 'alert')?.textContent;
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

describe('the sheet of Settle up', () => {
    it('opens from its button, titled and with the form in it', async () => {
        const group = trip();
        await open(group, debts(group));

        fireEvent.click(toggle());

        const dialog = screen.getByRole('dialog', { name: text.title });
        expect(within(dialog).getByRole('heading', { level: 2, name: text.title })).toBeDefined();
        expect(within(dialog).getByLabelText(text.amount)).toBeDefined();
    });

    it('has a button to close it, which drops what was typed', async () => {
        const group = trip();
        await open(group, debts(group));
        fireEvent.click(toggle());
        fireEvent.change(amount(), { target: { value: '7' } });

        fireEvent.click(within(settleUp()).getByRole('button', { name: text.close }));
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(toggle());

        expect(amount().value).toBe('');
    });

    it('is not in the page of a closed group', async () => {
        const group = trip({ closed: 'deleted' });
        await open(group, debts(group));

        expect(screen.queryByRole('button', { name: text.title })).toBeNull();
    });
});

describe('settling up from a line', () => {
    it('fills in who pays whom and how much, and puts the focus on the amount', async () => {
        const group = trip();
        await open(group, debts(group));

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));

        expect(chosenOption(text.from)).toBe(you);
        expect(chosenOption(text.to)).toBe('Bea');
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
        expect(spokenText(spokenStatus())).toBe(t('groups.balance.owed', { amount: euros(1000) }));
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
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(toggle());
    });

    it('goes back to where it starts for a person who leaves while it is open', async () => {
        const group = trip();
        const { api, app } = await open(group, debts(group));
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));

        api.groups[0]!.members.find((member) => member.id === bea.id)!.leftAt = 2;
        await act(() => app.queryClient.invalidateQueries({ queryKey: GROUPS_KEY }));

        await waitFor(() => expect(chosenOption(text.to)).toBe('Cris'));
        fireEvent.click(save());

        await waitFor(() =>
            expect(app.groupOutbox.getState().pending).toMatchObject([
                { paidBy: ana.id, shares: [{ memberId: cris.id, cents: 1500 }] },
            ])
        );
    });

    it('gives each of two settlements saved in a row an id of its own', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        onlineManager.setOnline(false);

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        fireEvent.change(amount(), { target: { value: '5' } });
        fireEvent.click(save());
        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1000) })));
        fireEvent.click(save());

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(2));
        const [first, second] = app.groupOutbox.getState().pending;
        expect(first!.id).not.toBe(second!.id);
    });

    it('saves once on a double tap', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        onlineManager.setOnline(false);

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        fireEvent.click(save());
        fireEvent.click(save());

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(app.groupOutbox.getState().pending).toHaveLength(1);
    });

    it('saves once when the form is sent twice before the first is kept', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        onlineManager.setOnline(false);

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        const form = amount().closest('form')!;
        fireEvent.submit(form);
        fireEvent.submit(form);

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(app.groupOutbox.getState().pending).toHaveLength(1);
    });

    it('ignores a second press of Save while the settlement is being kept, which is never off', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => (release = resolve));
        const put = vi.spyOn(app.groupOutbox, 'put').mockReturnValueOnce(held);

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        fireEvent.click(save());
        fireEvent.click(save());

        expect(save().disabled).toBe(false);
        expect(put).toHaveBeenCalledTimes(1);
        release();
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('saves nothing when the form is sent with a day that is not a day', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        onlineManager.setOnline(false);
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        fireEvent.change(date(), { target: { value: '' } });

        fireEvent.submit(amount().closest('form')!);

        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(app.groupOutbox.getState().pending).toEqual([]);
        expect(amount().value).toBe('15.00');
    });

    it('keeps the form and says so when the device cannot keep the settlement', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        vi.spyOn(app.groupOutbox, 'put').mockRejectedValueOnce(new Error('Storage is full'));

        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        fireEvent.click(save());

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.failed);
        expect(amount().value).toBe('15.00');
        expect(save().disabled).toBe(false);
    });

    it('says the group is closed, and keeps the settlement off the device, when it closed as Save was tapped', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));

        app.queryClient.setQueryData(GROUPS_KEY, [{ ...group, closed: 'deleted' }]);
        fireEvent.click(save());

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.readOnly);
        expect(app.groupOutbox.getState().pending).toEqual([]);
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

describe('settling up in the simplified view', () => {
    const dani = person('Dani');
    const youOweBea = t('groups.debts.youOwe', { name: 'Bea', amount: euros(500) });
    const crisOwesBea = t('groups.debts.owes', { from: 'Cris', to: 'Bea', amount: euros(1000) });

    function simplified(overrides: Partial<SharedGroup> = {}) {
        return trip({ simplifyDebts: true, ...overrides });
    }

    function reroutes(group: SharedGroup) {
        return [
            expense(group, bea, [[ana, 2000]]),
            expense(group, cris, [
                [ana, 1000],
                [dani, 1000],
            ]),
        ];
    }

    it('offers the payments of the view as the lines to settle, and takes one as it is', async () => {
        const group = simplified();
        await open(group, debts(group));

        expect(lines()).toEqual([youOweBea, crisOwesBea]);
        fireEvent.click(lineButton(crisOwesBea));

        expect(chosenOption(text.from)).toBe('Cris');
        expect(chosenOption(text.to)).toBe('Bea');
        expect(amount().value).toBe('10.00');
        expect(document.activeElement).toBe(amount());
        expect(hint()).toBe(sentences(crisOwesBea));
    });

    it('starts on you and on the one the view says you owe', async () => {
        const group = simplified();
        await open(group, debts(group));

        fireEvent.click(toggle());

        expect(chosenOption(text.from)).toBe(you);
        expect(chosenOption(text.to)).toBe('Bea');
        expect(hint()).toBe(sentences(youOweBea));
    });

    it('saves a plain settlement between the two of the line, and the lines change at once, offline too', async () => {
        const group = simplified();
        const { app } = await open(group, debts(group));
        onlineManager.setOnline(false);

        fireEvent.click(lineButton(youOweBea));
        fireEvent.click(save());

        await waitFor(() => expect(lines()).toEqual([crisOwesBea]));
        expect(spokenText(spokenStatus())).toBe(t('groups.balance.allSettled'));
        expect(app.groupOutbox.getState().pending).toMatchObject([
            {
                groupId: group.id,
                kind: 'settlement',
                text: '',
                amountCents: 500,
                paidBy: ana.id,
                split: 'exact',
                shares: [{ memberId: bea.id, cents: 500 }],
            },
        ]);
    });

    it('says in the hint what the lines will show after a partial payment re-routes them, and they do', async () => {
        const group = simplified({ members: [ana, bea, cris, dani] });
        await open(group, reroutes(group));
        const toBea = t('groups.debts.youOwe', { name: 'Bea', amount: euros(2000) });
        expect(lines()).toEqual([
            toBea,
            t('groups.debts.youOwe', { name: 'Cris', amount: euros(1000) }),
            t('groups.debts.owes', { from: 'Dani', to: 'Cris', amount: euros(1000) }),
        ]);

        fireEvent.click(lineButton(toBea));
        fireEvent.change(amount(), { target: { value: '5' } });

        const after = t('groups.settle.after.youOwe', { name: 'Bea', amount: euros(500) });
        expect(hint()).toBe(sentences(toBea, after));
        fireEvent.click(save());

        await waitFor(() =>
            expect(lines()).toEqual([
                t('groups.debts.youOwe', { name: 'Cris', amount: euros(2000) }),
                t('groups.debts.youOwe', { name: 'Bea', amount: euros(500) }),
                t('groups.debts.owes', { from: 'Dani', to: 'Bea', amount: euros(1000) }),
            ])
        );
    });

    it('says what follows a partial payment on the line of two other people', async () => {
        const group = simplified();
        await open(group, debts(group));
        fireEvent.click(lineButton(crisOwesBea));

        fireEvent.change(amount(), { target: { value: '4' } });

        expect(hint()).toBe(
            sentences(crisOwesBea, t('groups.settle.after.owes', { from: 'Cris', to: 'Bea', amount: euros(600) }))
        );
    });

    it('follows the view when the owner switches it while the form holds a debt', async () => {
        const group = trip();
        const { api, app } = await open(group, debts(group));
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        expect(amount().value).toBe('15.00');

        api.groups[0]!.simplifyDebts = true;
        await act(() => app.queryClient.invalidateQueries({ queryKey: GROUPS_KEY }));

        await waitFor(() => expect(lines()).toEqual([youOweBea, crisOwesBea]));
        expect(chosenOption(text.to)).toBe('Bea');
        expect(amount().value).toBe('15.00');
        expect(hint()).toBe(sentences(youOweBea, t('groups.settle.after.youSettled', { name: 'Bea' })));
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

        expect(chosenOption(text.from)).toBe(you);
        expect(chosenOption(text.to)).toBe('Bea');
        expect(amount().value).toBe('');
        expect(hint()).toBe(sentences(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        expect(save().disabled).toBe(false);
    });

    it('starts on today', async () => {
        const group = trip();
        await open(group, debts(group));

        fireEvent.click(toggle());

        expect(date().value).toBe(toDateString(new Date()));
    });

    it('starts on the one you owe most among several', async () => {
        const group = trip();
        await open(group, [
            expense(group, bea, [
                [ana, 500],
                [bea, 500],
            ]),
            expense(group, cris, [
                [ana, 1500],
                [cris, 1500],
            ]),
        ]);

        fireEvent.click(toggle());

        expect(chosenOption(text.to)).toBe('Cris');
        expect(hint()).toBe(sentences(t('groups.debts.youOwe', { name: 'Cris', amount: euros(1500) })));
    });

    it('marks the day when Save is pressed with a day that is not a day, and saves nothing', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        fireEvent.change(date(), { target: { value: '' } });

        expect(save().disabled).toBe(false);
        fireEvent.click(save());

        expect(date().getAttribute('aria-invalid')).toBe('true');
        expect(problemOf(date())).toBe(text.dateInvalid);
        expect(document.activeElement).toBe(date());
        expect(app.groupOutbox.getState().pending).toEqual([]);

        fireEvent.change(date(), { target: { value: '2026-10-25' } });

        expect(date().getAttribute('aria-invalid')).not.toBe('true');
    });

    it('keeps what was typed while the balances change under it', async () => {
        const group = trip();
        const { api, app } = await open(group, debts(group));
        fireEvent.click(toggle());
        choose(text.to, 'Cris');
        fireEvent.change(amount(), { target: { value: '3' } });

        api.serverWriteEntry(
            expense(group, bea, [
                [bea, 800],
                [cris, 800],
            ]),
            bea.id
        );
        await act(() => app.queryClient.invalidateQueries({ queryKey: groupEntriesKey(group.id) }));

        await waitFor(() =>
            expect(lines()).toContain(t('groups.debts.owes', { from: 'Cris', to: 'Bea', amount: euros(800) }))
        );
        expect(chosenOption(text.to)).toBe('Cris');
        expect(amount().value).toBe('3');
    });

    it('lists the people who have not left, and starts again when it is closed and opened again', async () => {
        const dani = person('Dani', { leftAt: 1 });
        const group = trip({ members: [ana, bea, cris, dani] });
        await open(group, debts(group));
        fireEvent.click(toggle());

        expect(optionNames(text.to)).toEqual([you, 'Bea', 'Cris']);
        pickOption(text.to, 'Cris');
        fireEvent.change(amount(), { target: { value: '3' } });
        closeSheet();
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(toggle());

        expect(chosenOption(text.to)).toBe('Bea');
        expect(amount().value).toBe('');
    });

    it.each(['', '0', '0,00', 'ten', '-5'])(
        'marks the amount %j when Save is pressed, says why, saves nothing and puts the focus on it',
        async (value) => {
            const group = trip();
            const { app } = await open(group, debts(group));
            fireEvent.click(toggle());
            fireEvent.change(amount(), { target: { value } });

            fireEvent.click(save());

            expect(amount().getAttribute('aria-invalid')).toBe('true');
            expect(problemOf(amount())).toBe(text.amountInvalid);
            expect(document.activeElement).toBe(amount());
            expect(app.groupOutbox.getState().pending).toEqual([]);
            expect(screen.getByRole('dialog')).toBeDefined();
        }
    );

    it('clears the mark of the amount once it is corrected, and then saves', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        fireEvent.click(toggle());
        fireEvent.click(save());
        expect(amount().getAttribute('aria-invalid')).toBe('true');

        fireEvent.change(amount(), { target: { value: '0.01' } });

        expect(amount().getAttribute('aria-invalid')).not.toBe('true');
        fireEvent.click(save());
        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
    });

    it('marks From being To, which it says as soon as it is so, and puts the focus on To when Save is pressed', async () => {
        const group = trip();
        const { app } = await open(group, debts(group));
        fireEvent.click(toggle());
        fireEvent.change(amount(), { target: { value: '5' } });

        choose(text.to, you);

        expect(screen.getByRole('alert').textContent).toBe(text.same);
        fireEvent.click(save());
        expect(document.activeElement).toBe(within(settleUp()).getByLabelText(text.to));
        expect(app.groupOutbox.getState().pending).toEqual([]);
    });

    it('marks every problem at once and puts the focus on the first', async () => {
        const group = trip();
        await open(group, debts(group));
        fireEvent.click(toggle());
        fireEvent.change(date(), { target: { value: '' } });

        fireEvent.click(save());

        expect(amount().getAttribute('aria-invalid')).toBe('true');
        expect(date().getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(amount());
    });

    it('tells assistive technology that the amount and the day are required, with no bubble of the browser', async () => {
        const group = trip();
        await open(group, debts(group));
        fireEvent.click(toggle());

        expect(amount().required).toBe(true);
        expect(date().required).toBe(true);
        expect(amount().closest('form')!.noValidate).toBe(true);
    });

    it('drops the marks when it is closed, so it opens clean', async () => {
        const group = trip();
        await open(group, debts(group));
        fireEvent.click(toggle());
        fireEvent.click(save());
        expect(amount().getAttribute('aria-invalid')).toBe('true');

        closeSheet();
        fireEvent.click(toggle());

        expect(amount().getAttribute('aria-invalid')).not.toBe('true');
    });

    it('says what follows from the amount typed', async () => {
        const group = trip();
        await open(group, debts(group));
        fireEvent.click(lineButton(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) })));
        const debt = t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) });

        expect(hint()).toBe(sentences(debt));
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

        expect(chosenOption(text.from)).toBe('Cris');
        expect(chosenOption(text.to)).toBe('Bea');
        expect(hint()).not.toContain(t('groups.settle.after.settled', { from: 'Cris', to: 'Bea' }));
        fireEvent.change(amount(), { target: { value: '2' } });
        expect(hint()).toContain(t('groups.settle.after.owes', { from: 'Cris', to: 'Bea', amount: euros(500) }));
    });
});

describe('where there is no settling up', () => {
    it('has none in a closed group', async () => {
        const group = trip({ closed: 'deleted' });
        await open(group, debts(group));

        expect(within(sheet()).queryAllByRole('button', { name: /^Settle up/ })).toEqual([]);
        expect(screen.queryByRole('button', { name: text.open })).toBeNull();
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

describe('naming the person in From and To', () => {
    it('lists them as their name and (You), where the sentences keep a plain You', async () => {
        const group = trip();
        await open(group, debts(group));
        fireEvent.click(toggle());

        expect(you).toBe('Ana (You)');
        expect(chosenOption(text.from)).toBe(you);
        expect(chosenOption(text.to)).toBe('Bea');
        expect(screen.queryByRole('option', { name: 'You' })).toBeNull();
        fireEvent.change(amount(), { target: { value: '5' } });
        expect(hint()).toContain(t('groups.debts.youOwe', { name: 'Bea', amount: euros(1500) }));
        expect(hint()).toContain(t('groups.settle.after.youOwe', { name: 'Bea', amount: euros(1000) }));
    });

    it('numbers the name when another member has the same one', async () => {
        const first = person('Ana', { role: 'owner' });
        const second = person('Ana');
        const group = trip({ members: [first, second, bea], me: second.id });
        await open(group, [
            expense(group, bea, [
                [first, 1500],
                [second, 1500],
            ]),
        ]);
        fireEvent.click(toggle());

        expect(chosenOption(text.from)).toBe('Ana (2) (You)');
        expect(optionNames(text.to)).toEqual(['Ana', 'Ana (2) (You)', 'Bea']);
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
        const mine = await waitFor(
            () => within(label.closest('section')!).getAllByRole('button', { expanded: false })[0]!
        );
        fireEvent.click(mine);

        const buttons = within(label.closest('section')!)
            .getAllByRole('button')
            .filter((button) => button.hasAttribute('aria-label'));
        expect(buttons).toHaveLength(2);
        for (const button of buttons) {
            expect(button.getAttribute('aria-label')!.toLowerCase()).toContain(button.textContent!.toLowerCase());
        }
    });
});

describe('settling up in Spanish', () => {
    it('lists the person as their name and (Tú)', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const group = trip();
        const api = createFakeApi({ groups: [group], entries: debts(group) });
        stubApi(api.handler);
        renderApp({ path: `/groups/${group.id}` });

        fireEvent.click(await screen.findByRole('button', { name: es.groups.settle.open }));

        expect(chosenOption(es.groups.settle.from)).toBe('Ana (Tú)');
        expect(optionNames(es.groups.settle.to)).toEqual(['Ana (Tú)', 'Bea', 'Cris']);
    });

    it('fills in the amount and reads what is typed the Spanish way', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const tEs = createTranslator({ locale: 'es', messages: es });
        const amountEs = (cents: number) => formatAmount(cents, 'EUR', 'es');
        const group = trip();
        const api = createFakeApi({ groups: [group], entries: debts(group) });
        stubApi(api.handler);
        const app = renderApp({ path: `/groups/${group.id}` });
        const debt = tEs('groups.debts.youOwe', { name: 'Bea', amount: amountEs(1500) });
        const label = await screen.findByRole('heading', { name: es.groups.debts.label });
        fireEvent.click(
            await waitFor(() => within(label.closest('section')!).getAllByRole('button', { expanded: false })[0]!)
        );
        const button = await screen.findByRole('button', { name: tEs('groups.settle.lineItem', { debt }) });

        fireEvent.click(button);
        const panel = screen.getByRole('dialog', { name: es.groups.settle.title });
        const field = within(panel).getByLabelText(es.groups.settle.amount) as HTMLInputElement;
        expect(field.value).toBe('15,00');
        fireEvent.change(field, { target: { value: '12,50' } });
        const hintEs = () =>
            document.getElementById(field.getAttribute('aria-describedby')!.split(' ')[0]!)!.textContent;
        expect(hintEs()).toContain(tEs('groups.settle.after.youOwe', { name: 'Bea', amount: amountEs(250) }));
        fireEvent.change(field, { target: { value: '1.500' } });
        expect(hintEs()).toContain(tEs('groups.settle.after.owesYou', { name: 'Bea', amount: amountEs(148500) }));
        fireEvent.change(field, { target: { value: '12,50' } });
        onlineManager.setOnline(false);
        fireEvent.click(screen.getByRole('button', { name: es.groups.settle.save }));

        await waitFor(() => expect(app.groupOutbox.getState().pending).toMatchObject([{ amountCents: 1250 }]));
    });
});
