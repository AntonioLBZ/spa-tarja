import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import es from '@/assets/locales/es.json';
import { groupEntriesKey } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { chosenOption, optionNames, pickOption } from '@/lib/testing/select';
import {
    amount,
    ana,
    bea,
    choose,
    closeSheet,
    cris,
    date,
    debts,
    euros,
    expense,
    hint,
    lineButton,
    lines,
    open,
    problemOf,
    save,
    sentences,
    settleUp,
    t,
    text,
    toggle,
    trip,
    you,
} from '@/lib/testing/settle-up';
import { toDateString } from '@core/basics/date';
import { formatAmount } from '@core/basics/money';

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
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
