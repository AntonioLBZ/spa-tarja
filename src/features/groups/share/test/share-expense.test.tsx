import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { GROUPS_KEY, groupEntriesKey } from '@/lib/api';
import { rememberSharedWith } from '@/lib/offline';
import { randomSeed } from '@/lib/random';
import { createFakeApi } from '@/lib/testing/fake-api';
import { TEST_USER, createFakeAuth } from '@/lib/testing/fake-auth';
import { seedFavouring } from '@/lib/testing/favouring-seed';
import { person, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { chosenOption, optionNames, pickOption } from '@/lib/testing/select';
import {
    addButton,
    addIsRefused,
    ana,
    balance,
    bea,
    checkbox,
    cris,
    euros,
    field,
    fill,
    forChoice,
    form,
    friend,
    openGroup,
    openHome,
    pickMode,
    rows,
    share,
    shareField,
    splitToggle,
    summaryLines,
    t,
    theForm,
    trip,
    you,
} from '@/lib/testing/share-expense';
import { openAddSheet } from '@/lib/testing/sheet';
import { addMonths, toDateString } from '@core/basics/date';

import type { SharedGroup } from '@core/groups/shared-group';

vi.mock('@/lib/random', () => ({ randomSeed: vi.fn() }));

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

        expect(optionNames(share.with)).toEqual([share.withNone, 'Trip', 'Dani']);
    });

    it('chooses no group for another user of the device, who never shared with the last one, and opens the split', async () => {
        const dani = friend('Dani');
        rememberSharedWith(TEST_USER.id, dani.id);
        stubApi(createFakeApi({ groups: [trip(), dani] }).handler);
        const other = { id: 'user-bea', name: 'Bea', email: 'bea@example.com' };
        const app = renderApp({ fakeAuth: createFakeAuth({ session: other }) });
        await screen.findByRole('button', { name: en.nav.add });
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
        await openAddSheet();

        fireEvent.click(forChoice(form.forShared));

        expect(splitToggle().getAttribute('aria-expanded')).toBe('true');
        expect(chosenOption(share.with)).toBe(share.withNone);
        expect(summaryLines()).toEqual([share.withNone]);
        expect(screen.queryByRole('group', { name: share.people })).toBeNull();
        expect(localStorage.getItem(`tarja:shared-with:${other.id}`)).toBeNull();
    });

    it('marks With on Add while no group is chosen, opening the split', async () => {
        await openHome([trip(), friend('Dani')]);
        fireEvent.click(forChoice(form.forShared));
        fireEvent.click(splitToggle());
        fill({ amount: '10' });

        await addIsRefused();

        expect(splitToggle().getAttribute('aria-expanded')).toBe('true');
        const withField = screen.getByRole('combobox', { name: share.with });
        expect(withField.getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByText(share.withMissing)).toBeDefined();
        expect(document.activeElement).toBe(withField);

        pickOption(share.with, 'Dani');

        expect(withField.getAttribute('aria-invalid')).toBe('false');
        expect(optionNames(share.with)).toEqual(['Trip', 'Dani']);
        expect(rows()).toEqual([`${you}${euros(500)}`, `Dani${euros(500)}`]);
    });

    it('puts For first, as tabs above the amount, and With first inside the split', async () => {
        await openHome([trip(), friend('Dani')]);
        const dialog = screen.getByRole('dialog', { name: form.title });
        const follows = (first: Element, second: Element) =>
            (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

        const tabs = within(dialog).getByRole('group', { name: form.for });
        expect(
            within(tabs)
                .getAllByRole('radio')
                .map((radio) => radio.closest('label')?.textContent)
        ).toEqual([form.forMe, form.forShared]);
        expect(follows(tabs, field(form.amount))).toBe(true);
        fireEvent.click(forChoice(form.forShared));
        pickOption(share.with, 'Trip');

        expect(follows(splitToggle(), screen.getByRole('combobox', { name: share.with }))).toBe(true);
        expect(
            follows(
                screen.getByRole('combobox', { name: share.with }),
                screen.getByRole('combobox', { name: share.paidBy })
            )
        ).toBe(true);
    });

    it('lists the person first in Paid by and in Who is in, the others in the order of the group', async () => {
        await openHome([trip({ members: [bea, ana, cris] })]);

        fireEvent.click(forChoice(form.forShared));

        expect(optionNames(share.paidBy)).toEqual([you, 'Bea', 'Cris']);
        expect(rows()).toEqual([you, 'Bea', 'Cris']);
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
        await addIsRefused();
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

        expect(optionNames(share.paidBy)).toEqual(['Ana (2) (You)', 'Ana', 'Cris']);
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
        await addIsRefused();
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

        const { other, ...rest } = en.categories;
        expect(optionNames(form.category)).toEqual([other, ...Object.values(rest), 'Kids']);
        fireEvent.click(forChoice(form.forShared));
        expect(optionNames(form.category)).toEqual([other, ...Object.values(rest)]);
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

        expect(optionNames(share.with)).toEqual([share.withNone, 'Trip', 'Dani']);
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
        await addIsRefused();
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
