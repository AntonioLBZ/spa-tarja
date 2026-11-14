import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { groupEntriesKey } from '@/lib/api';
import { randomSeed } from '@/lib/random-seed';
import { createFakeApi } from '@/lib/test/fake-api';
import { seedFavouring } from '@/lib/test/favouring-seed';
import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { chosenOption, optionNames, pickOption } from '@/lib/test/select';
import { closeSheet, openAddSheet, openSplit } from '@/lib/test/sheet';

import type { PendingEntry } from '@/lib/offline';
import type { SeededEntry } from '@/lib/test/fake-groups';
import type { SharedGroup } from '@core/shared-group';

vi.mock('@/lib/random-seed', () => ({ randomSeed: vi.fn() }));

const t = createTranslator({ locale: 'en', messages: en });
const form = en.expenses.form;
const share = en.groups.share;
const you = t('groups.names.you', { name: 'Ana' });
const list = en.expenses.list;
const NOW = new Date(2026, 9, 27, 12).getTime();

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');
const cris = person('Cris');

function trip(overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ name: 'Trip', members: [ana, bea, cris], me: ana.id, ...overrides });
}

function dinner(group: SharedGroup, overrides: Partial<Extract<PendingEntry, { kind: 'expense' }>> = {}) {
    return sampleEntry(group, {
        text: 'Dinner',
        amountCents: 1000,
        createdAt: 500,
        updatedAt: 1_000,
        shares: [
            { memberId: ana.id, cents: 333 },
            { memberId: bea.id, cents: 333 },
            { memberId: cris.id, cents: 334 },
        ],
        ...overrides,
    });
}

async function open(group: SharedGroup, entries: SeededEntry[]) {
    const api = createFakeApi({ groups: [group], entries });
    stubApi(api.handler);
    const app = renderApp({ path: `/groups/${group.id}` });
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(app.queryClient.getQueryState(groupEntriesKey(group.id))?.status).toBe('success'));
    return { api, app };
}

function theLedger() {
    return document.querySelector<HTMLElement>('.group-ledger')!;
}

function toggle(name: string) {
    return within(theLedger()).getByText(name).closest('button')!;
}

function actionOf(name: string, action: 'editItem' | 'duplicateItem' | 'deleteItem') {
    if (toggle(name).getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle(name));
    return screen.getByRole('button', { name: t(`expenses.list.${action}`, { name }) }) as HTMLButtonElement;
}

function field(label: string) {
    const dialog = screen.queryByRole('dialog');
    return (dialog ? within(dialog) : screen).getByLabelText(label) as HTMLInputElement;
}

function people() {
    openSplit();
    return screen.getByRole('group', { name: share.people });
}

function shareValues() {
    return within(people())
        .queryAllByRole('textbox')
        .map((input) => (input as HTMLInputElement).value);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(randomSeed).mockReturnValue(seedFavouring(0));
});

afterEach(() => {
    vi.useRealTimers();
    vi.mocked(randomSeed).mockReset();
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('editing a shared expense', () => {
    it('opens the form with what was saved, under its heading, which takes the focus', async () => {
        const group = trip();
        await open(group, [dinner(group, { paidBy: bea.id, split: 'percent', date: '2026-10-20' })]);

        fireEvent.click(actionOf('Dinner', 'editItem'));

        const dialog = screen.getByRole('dialog', { name: form.editTitle });
        expect(document.activeElement).toBe(dialog);
        expect(field(form.amount).value).toBe('10.00');
        expect(field(form.text).value).toBe('Dinner');
        expect(field(form.date).value).toBe('2026-10-20');
        expect(chosenOption(form.category)).toBe(en.categories.food);
        expect(chosenOption(share.paidBy)).toBe('Bea');
        expect((screen.getByRole('radio', { name: share.modes.percent }) as HTMLInputElement).checked).toBe(true);
        expect(shareValues()).toEqual(['33.30', '33.30', '33.40']);
        expect(screen.getByRole('button', { name: form.save })).toBeDefined();
        expect(screen.getByRole('button', { name: form.cancel })).toBeDefined();
    });

    it('opens the amounts as saved and leaves out who was not in', async () => {
        const group = trip();
        await open(group, [
            dinner(group, {
                split: 'exact',
                shares: [
                    { memberId: ana.id, cents: 250 },
                    { memberId: cris.id, cents: 750 },
                ],
            }),
        ]);

        fireEvent.click(actionOf('Dinner', 'editItem'));

        expect(shareValues()).toEqual(['2.50', '7.50']);
        expect((within(people()).getByRole('checkbox', { name: 'Bea' }) as HTMLInputElement).checked).toBe(false);
    });

    it('saves under the same id and day it was made, later, with the cents of a split it did not touch', async () => {
        const group = trip();
        const saved = dinner(group);
        const { api } = await open(group, [saved]);
        fireEvent.click(actionOf('Dinner', 'editItem'));

        fireEvent.change(field(form.text), { target: { value: 'Supper' } });
        fireEvent.click(screen.getByRole('button', { name: form.save }));

        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]).toMatchObject({
            id: saved.id,
            text: 'Supper',
            createdAt: 500,
            updatedAt: NOW,
            shares: saved.shares,
        });
        expect(await within(theLedger()).findByText('Supper')).toBeDefined();
    });

    it('splits again once the amount changes', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group)]);
        fireEvent.click(actionOf('Dinner', 'editItem'));

        fireEvent.change(field(form.amount), { target: { value: '20' } });
        fireEvent.click(screen.getByRole('button', { name: form.save }));

        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        const shares = api.entryWrites[0]!.shares;
        expect(shares.map((item) => item.memberId)).toEqual([ana.id, bea.id, cris.id]);
        expect(shares.map((item) => item.cents).toSorted()).toEqual([666, 667, 667]);
    });

    it('is later than the version it replaces when the clock of the device is behind', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group, { updatedAt: NOW + 5_000 })]);
        fireEvent.click(actionOf('Dinner', 'editItem'));

        fireEvent.click(screen.getByRole('button', { name: form.save }));

        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]!.updatedAt).toBe(NOW + 5_001);
    });

    it('goes back to adding once saved or cancelled, with the focus on the row', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group)]);
        fireEvent.click(actionOf('Dinner', 'editItem'));

        fireEvent.click(screen.getByRole('button', { name: form.cancel }));

        await waitFor(() => expect(document.activeElement).toBe(toggle('Dinner')));
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(api.entryAttempts).toEqual([]);

        fireEvent.click(actionOf('Dinner', 'editItem'));
        fireEvent.click(screen.getByRole('button', { name: form.save }));
        await waitFor(() => expect(document.activeElement).toBe(toggle('Dinner')));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('replaces a half typed expense, which is not kept once it is over', async () => {
        const group = trip();
        await open(group, [dinner(group)]);
        const typing = await openAddSheet();
        fireEvent.change(within(typing).getByLabelText(form.amount), { target: { value: '99' } });
        await closeSheet();

        fireEvent.click(actionOf('Dinner', 'editItem'));
        expect(field(form.amount).value).toBe('10.00');
        fireEvent.click(screen.getByRole('button', { name: form.cancel }));

        const again = await openAddSheet();
        expect((within(again).getByLabelText(form.amount) as HTMLInputElement).value).toBe('');
    });

    it('keeps the card of the payer when somebody else edits it', async () => {
        const group = trip();
        const { api } = await open(group, [
            dinner(group, { paidBy: bea.id, payment: 'credit', chargeDate: '2026-11-05', date: '2026-10-25' }),
        ]);
        fireEvent.click(actionOf('Dinner', 'editItem'));

        expect(screen.queryByRole('combobox', { name: share.howYouPaid })).toBeNull();
        fireEvent.change(field(form.text), { target: { value: 'Supper' } });
        fireEvent.click(screen.getByRole('button', { name: form.save }));

        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]).toMatchObject({ paidBy: bea.id, payment: 'credit', chargeDate: '2026-11-05' });
    });

    it('is paid now when somebody else edits it and changes who paid, since the card was the payer’s', async () => {
        const group = trip({ me: bea.id });
        const { app } = await open(group, [
            dinner(group, { paidBy: ana.id, payment: 'credit', chargeDate: '2026-11-05', date: '2026-10-25' }),
        ]);
        onlineManager.setOnline(false);
        fireEvent.click(actionOf('Dinner', 'editItem'));
        expect(chosenOption(share.paidBy)).toBe('Ana');

        pickOption(share.paidBy, 'Cris');
        fireEvent.click(screen.getByRole('button', { name: form.save }));

        await waitFor(() => expect(app.groupOutbox.getState().pending).toHaveLength(1));
        expect(app.groupOutbox.getState().pending[0]).toMatchObject({
            paidBy: cris.id,
            payment: 'direct',
            chargeDate: null,
        });
    });

    it('opens the card of your own as you paid it', async () => {
        const group = trip();
        await open(group, [dinner(group, { payment: 'credit', chargeDate: '2026-11-05', date: '2026-10-25' })]);

        fireEvent.click(actionOf('Dinner', 'editItem'));

        expect(chosenOption(share.howYouPaid)).toBe(en.expenses.payment.credit);
        expect(field(form.chargeDate).value).toBe('2026-11-05');
    });

    it('is off for an entry that names somebody who left, and says why; Delete is still there', async () => {
        const gone = person('Dani', { leftAt: 1 });
        const group = trip({ members: [ana, bea, gone] });
        await open(group, [
            dinner(group, {
                shares: [
                    { memberId: ana.id, cents: 500 },
                    { memberId: gone.id, cents: 500 },
                ],
            }),
        ]);

        const edit = actionOf('Dinner', 'editItem');

        expect(edit.disabled).toBe(true);
        expect(document.getElementById(edit.getAttribute('aria-describedby')!)?.textContent).toBe(
            en.groups.ledger.leftCantEdit
        );
        expect(actionOf('Dinner', 'deleteItem').disabled).toBe(false);
    });

    it('works offline, the row marked as not synced yet', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group)]);
        onlineManager.setOnline(false);
        fireEvent.click(actionOf('Dinner', 'editItem'));

        fireEvent.change(field(form.text), { target: { value: 'Supper' } });
        fireEvent.click(screen.getByRole('button', { name: form.save }));

        const row = (await within(theLedger()).findByText('Supper')).closest('li')!;
        expect(within(row).getByText(list.pending)).toBeDefined();
        expect(api.entryAttempts).toEqual([]);
    });

    it('puts the row back as the server kept it when the server refuses the edit, and says why', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group)]);
        api.state.entryRefusal = { status: 422, error: 'member-left' };
        fireEvent.click(actionOf('Dinner', 'editItem'));

        fireEvent.change(field(form.text), { target: { value: 'Supper' } });
        fireEvent.click(screen.getByRole('button', { name: form.save }));

        const said = `${t('groups.refused.change', { name: 'Supper', group: 'Trip' })} ${en.groups.refused.reason.memberLeft}`;
        expect(await screen.findByText(said)).toBeDefined();
        expect(within(theLedger()).getByText('Dinner')).toBeDefined();
        expect(within(theLedger()).queryByText('Supper')).toBeNull();
    });

    it('sends an edit whose answer was lost once more, and the group holds it once', async () => {
        const group = trip();
        const saved = dinner(group);
        const { api, app } = await open(group, [saved]);
        api.state.loseEntryAnswers = true;
        fireEvent.click(actionOf('Dinner', 'editItem'));

        fireEvent.change(field(form.text), { target: { value: 'Supper' } });
        fireEvent.click(screen.getByRole('button', { name: form.save }));
        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        api.state.loseEntryAnswers = false;
        await act(() => app.queryClient.invalidateQueries({ queryKey: groupEntriesKey(group.id) }));

        await waitFor(() => expect(app.groupOutbox.getState().pending).toEqual([]));
        expect(api.entriesOf(group.id)).toMatchObject([{ id: saved.id, text: 'Supper' }]);
        expect(api.entryWrites).toHaveLength(1);
    });
});

describe('duplicating a shared expense', () => {
    it('opens the form as a new one of today, with the same payer, split and people', async () => {
        const group = trip();
        await open(group, [
            dinner(group, {
                paidBy: bea.id,
                date: '2026-10-20',
                shares: [
                    { memberId: bea.id, cents: 500 },
                    { memberId: cris.id, cents: 500 },
                ],
            }),
        ]);

        fireEvent.click(actionOf('Dinner', 'duplicateItem'));

        expect(document.activeElement).toBe(screen.getByRole('dialog', { name: form.copyTitle }));
        expect(field(form.amount).value).toBe('10.00');
        expect(field(form.date).value).toBe('2026-10-27');
        expect(chosenOption(share.paidBy)).toBe('Bea');
        expect((within(people()).getByRole('checkbox', { name: you }) as HTMLInputElement).checked).toBe(false);
        expect(screen.getByRole('button', { name: form.submit })).toBeDefined();
    });

    it('adds a new entry, the original kept, with the focus back on the row it was copied from', async () => {
        const group = trip();
        const saved = dinner(group);
        const { api } = await open(group, [saved]);
        fireEvent.click(actionOf('Dinner', 'duplicateItem'));

        fireEvent.click(screen.getByRole('button', { name: form.submit }));

        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]!.id).not.toBe(saved.id);
        expect(api.entryWrites[0]).toMatchObject({ text: 'Dinner', date: '2026-10-27', createdAt: NOW });
        await waitFor(() => expect(within(theLedger()).getAllByText('Dinner')).toHaveLength(2));
        const original = within(theLedger()).getAllByText('Dinner')[1];
        await waitFor(() => expect(document.activeElement).toBe(original!.closest('button')));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('draws the cents left again, as for a new expense, instead of keeping those of the original', async () => {
        const group = trip();
        const { api } = await open(group, [dinner(group)]);
        vi.mocked(randomSeed).mockReturnValue(seedFavouring(1));
        fireEvent.click(actionOf('Dinner', 'duplicateItem'));

        expect(
            within(people())
                .getAllByRole('listitem')
                .map((row) => row.textContent)
        ).toEqual([`${you}€3.33`, 'Bea€3.34', 'Cris€3.33']);
        fireEvent.click(screen.getByRole('button', { name: form.submit }));

        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]!.shares).toEqual([
            { memberId: ana.id, cents: 333 },
            { memberId: bea.id, cents: 334 },
            { memberId: cris.id, cents: 333 },
        ]);
    });

    it('is paid now when somebody else paid by card', async () => {
        const group = trip();
        const { api } = await open(group, [
            dinner(group, { paidBy: bea.id, payment: 'voucher', chargeDate: '2026-11-01', date: '2026-10-25' }),
        ]);
        fireEvent.click(actionOf('Dinner', 'duplicateItem'));

        fireEvent.click(screen.getByRole('button', { name: form.submit }));

        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]).toMatchObject({ paidBy: bea.id, payment: 'direct', chargeDate: null });
    });

    it('leaves out whoever left, and is never offered for a settlement', async () => {
        const gone = person('Dani', { leftAt: 1 });
        const group = trip({ members: [ana, bea, gone] });
        await open(group, [
            dinner(group, {
                shares: [
                    { memberId: ana.id, cents: 500 },
                    { memberId: gone.id, cents: 500 },
                ],
            }),
        ]);

        fireEvent.click(actionOf('Dinner', 'duplicateItem'));

        expect(optionNames(share.paidBy)).toEqual([you, 'Bea']);
        expect(
            within(people())
                .getAllByRole('checkbox')
                .map((box) => box.parentElement?.textContent)
        ).toEqual([you, 'Bea']);
    });

    it('starts without a payer when the one who paid has left, and saves once somebody present is chosen', async () => {
        const gone = person('Dani', { leftAt: 1 });
        const group = trip({ members: [ana, bea, gone] });
        const { api } = await open(group, [
            dinner(group, {
                paidBy: gone.id,
                shares: [
                    { memberId: ana.id, cents: 500 },
                    { memberId: bea.id, cents: 500 },
                ],
            }),
        ]);

        fireEvent.click(actionOf('Dinner', 'duplicateItem'));

        expect(chosenOption(share.paidBy)).toBe(share.paidByNone);
        expect(optionNames(share.paidBy)).toEqual([share.paidByNone, you, 'Bea']);
        expect(screen.getByText(share.payerLeft)).toBeDefined();
        const submit = screen.getByRole('button', { name: form.submit }) as HTMLButtonElement;
        expect(submit.disabled).toBe(false);
        fireEvent.click(submit);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.entryWrites).toHaveLength(0);
        const paidBy = screen.getByRole('combobox', { name: share.paidBy });
        expect(screen.getByRole('alert').textContent).toBe(share.payerLeft);
        expect(paidBy.getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(paidBy);

        pickOption(share.paidBy, 'Bea');

        expect(screen.queryByText(share.payerLeft)).toBeNull();
        fireEvent.click(submit);
        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]).toMatchObject({ paidBy: bea.id, payment: 'direct' });
    });
});

describe('editing a settlement', () => {
    const settle = en.groups.settle;

    function paidYou() {
        return t('groups.ledger.paidYou', { name: 'Bea' });
    }

    function settleField(label: string) {
        return within(document.querySelector<HTMLElement>('.settle-up')!).getByLabelText(label) as HTMLInputElement;
    }

    it('fills Settle up with who paid whom, the amount and the day, under its own title, which takes the focus', async () => {
        const group = trip();
        await open(group, [{ ...sampleSettlement(group, bea.id, ana.id, 500), date: '2026-10-20' }]);

        fireEvent.click(actionOf(paidYou(), 'editItem'));

        const dialog = screen.getByRole('dialog', { name: settle.editTitle });
        expect(document.activeElement).toBe(dialog);
        expect(chosenOption(settle.from)).toBe('Bea');
        expect(chosenOption(settle.to)).toBe(you);
        expect(settleField(settle.amount).value).toBe('5.00');
        expect(settleField(settle.date).value).toBe('2026-10-20');
        expect(screen.getByRole('button', { name: settle.cancel })).toBeDefined();
    });

    it('saves under the same id and day it was made, later, then closes with the focus back on the row', async () => {
        const group = trip();
        const saved = { ...sampleSettlement(group, bea.id, ana.id, 500), createdAt: 500, updatedAt: 1_000 };
        const { api } = await open(group, [saved]);
        fireEvent.click(actionOf(paidYou(), 'editItem'));

        fireEvent.change(settleField(settle.amount), { target: { value: '7' } });
        fireEvent.click(screen.getByRole('button', { name: settle.save }));

        await waitFor(() => expect(api.entryWrites).toHaveLength(1));
        expect(api.entryWrites[0]).toMatchObject({
            id: saved.id,
            kind: 'settlement',
            amountCents: 700,
            paidBy: bea.id,
            shares: [{ memberId: ana.id, cents: 700 }],
            createdAt: 500,
            updatedAt: NOW,
        });
        await waitFor(() => expect(document.activeElement).toBe(toggle(paidYou())));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('writes nothing on Cancel, and Settle up starts over', async () => {
        const group = trip();
        const { api } = await open(group, [sampleSettlement(group, bea.id, ana.id, 500)]);
        fireEvent.click(actionOf(paidYou(), 'editItem'));

        fireEvent.click(screen.getByRole('button', { name: settle.cancel }));

        await waitFor(() => expect(document.activeElement).toBe(toggle(paidYou())));
        fireEvent.click(screen.getByRole('button', { name: settle.title }));
        expect(settleField(settle.amount).value).toBe('');
        expect(api.entryAttempts).toEqual([]);
    });

    it('leaves the settlement being edited out of what the hint says is owed', async () => {
        const group = trip();
        await open(group, [
            dinner(group, {
                amountCents: 2000,
                shares: [
                    { memberId: ana.id, cents: 1000 },
                    { memberId: bea.id, cents: 1000 },
                ],
            }),
            sampleSettlement(group, bea.id, ana.id, 400),
        ]);

        fireEvent.click(actionOf(paidYou(), 'editItem'));

        const before = t('groups.debts.owesYou', { name: 'Bea', amount: '€10.00' });
        const after = t('groups.settle.after.owesYou', { name: 'Bea', amount: '€6.00' });
        expect(screen.getByText(`${before}. ${after}.`)).toBeDefined();
    });

    it('leaves the settlement being edited out of the debts of the simplified view', async () => {
        const group = trip({ simplifyDebts: true });
        await open(group, [
            dinner(group, {
                amountCents: 2000,
                shares: [
                    { memberId: ana.id, cents: 1000 },
                    { memberId: bea.id, cents: 1000 },
                ],
            }),
            dinner(group, {
                text: 'Taxi',
                paidBy: bea.id,
                amountCents: 1000,
                shares: [
                    { memberId: bea.id, cents: 500 },
                    { memberId: cris.id, cents: 500 },
                ],
            }),
            sampleSettlement(group, bea.id, ana.id, 400),
        ]);

        fireEvent.click(actionOf(paidYou(), 'editItem'));

        const before = t('groups.debts.owesYou', { name: 'Bea', amount: '€5.00' });
        const after = t('groups.settle.after.owesYou', { name: 'Bea', amount: '€1.00' });
        expect(screen.getByText(`${before}. ${after}.`)).toBeDefined();
    });

    it('is off for a settlement with somebody who left', async () => {
        const gone = person('Dani', { leftAt: 1 });
        const group = trip({ members: [ana, bea, gone] });
        await open(group, [sampleSettlement(group, gone.id, ana.id, 500)]);

        expect(
            actionOf(t('groups.ledger.paidYou', { name: t('groups.names.left', { name: 'Dani' }) }), 'editItem')
                .disabled
        ).toBe(true);
    });
});

describe('the group screen without a form of its own', () => {
    it('has no add form: adding is the plus', async () => {
        const group = trip();
        await open(group, [dinner(group)]);

        expect(within(screen.getByRole('main')).queryByRole('button', { name: form.title })).toBeNull();
        expect(screen.queryByRole('form')).toBeNull();
    });

    it('opens the sheet to edit an entry, fixed to its group', async () => {
        const group = trip();
        await open(group, [dinner(group)]);

        fireEvent.click(actionOf('Dinner', 'editItem'));

        const dialog = await screen.findByRole('dialog', { name: form.editTitle });
        expect((within(dialog).getByLabelText(form.amount) as HTMLInputElement).value).toBe('10.00');
        expect(within(dialog).queryByRole('radio', { name: form.forShared })).toBeNull();
        expect(within(dialog).queryByRole('combobox', { name: share.with })).toBeNull();
        expect(within(dialog).getByRole('button', { name: new RegExp(`^${share.split}`) })).toBeDefined();
    });

    it('opens the sheet to duplicate an entry as a new one of the same group', async () => {
        const group = trip();
        await open(group, [dinner(group)]);

        fireEvent.click(actionOf('Dinner', 'duplicateItem'));

        const dialog = await screen.findByRole('dialog', { name: form.copyTitle });
        expect((within(dialog).getByLabelText(form.text) as HTMLInputElement).value).toBe('Dinner');
        expect(within(dialog).queryByRole('combobox', { name: share.with })).toBeNull();
    });
});

describe('closing the sheet of a settlement being edited', () => {
    it('ends the edit, with the focus on the row, and Settle up starts over', async () => {
        const group = trip();
        const { api } = await open(group, [sampleSettlement(group, bea.id, ana.id, 500)]);
        fireEvent.click(actionOf(t('groups.ledger.paidYou', { name: 'Bea' }), 'editItem'));
        const dialog = screen.getByRole('dialog', { name: en.groups.settle.editTitle });

        fireEvent.click(within(dialog).getByRole('button', { name: en.groups.settle.close }));

        await waitFor(() => expect(document.activeElement).toBe(toggle(t('groups.ledger.paidYou', { name: 'Bea' }))));
        expect(screen.queryByRole('dialog')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: en.groups.settle.title }));
        expect(
            (within(screen.getByRole('dialog')).getByLabelText(en.groups.settle.amount) as HTMLInputElement).value
        ).toBe('');
        expect(api.entryAttempts).toEqual([]);
    });
});
