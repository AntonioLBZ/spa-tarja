import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import { person } from '@/lib/testing/groups';
import { chosenOption } from '@/lib/testing/select';
import {
    amount,
    ana,
    bea,
    cris,
    date,
    debts,
    euros,
    expense,
    hint,
    lineButton,
    lines,
    open,
    save,
    sentences,
    settleUp,
    sheet,
    spokenStatus,
    t,
    text,
    toggle,
    trip,
    you,
} from '@/lib/testing/settle-up';
import { spokenText } from '@/lib/testing/spoken-text';

import type { SharedGroup } from '@core/groups/shared-group';

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
