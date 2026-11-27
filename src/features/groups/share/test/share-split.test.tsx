import { onlineManager } from '@tanstack/react-query';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import es from '@/assets/locales/es.json';
import { GROUPS_KEY } from '@/lib/api';
import { randomSeed } from '@/lib/random';
import { createFakeApi } from '@/lib/testing/fake-api';
import { TEST_USER } from '@/lib/testing/fake-auth';
import { seedFavouring } from '@/lib/testing/favouring-seed';
import { person } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { optionNames, pickOption } from '@/lib/testing/select';
import {
    addButton,
    addIsRefused,
    amountsShown,
    ana,
    bea,
    checkbox,
    cris,
    euros,
    field,
    fill,
    forChoice,
    form,
    openHome,
    percent,
    pickMode,
    rows,
    share,
    shareField,
    shareValues,
    splitToggle,
    spokenLeft,
    summaryLines,
    t,
    theForm,
    trip,
    you,
} from '@/lib/testing/share-expense';
import { openAddSheet, openSplit } from '@/lib/testing/sheet';
import { toDateString } from '@core/basics/date';

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

    it('saves nothing and says so while nobody is in', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        for (const name of [you, 'Bea', 'Cris']) fireEvent.click(checkbox(name));

        expect(screen.getByRole('alert').textContent).toBe(share.nobody);
        await addIsRefused();
    });

    it('saves nothing and marks the amount while it is not one', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));

        fill({ amount: 'ten' });

        await addIsRefused();
        expect(field(form.amount).getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(field(form.amount));
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

    it('says what is left or over, and saves nothing until it adds up to 100', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickMode('percent');

        fireEvent.change(shareField('Cris', 'percentOf'), { target: { value: '30.83' } });
        await waitFor(() => expect(spokenLeft()).toBe(t('groups.share.percentLeft', { percent: percent(250) })), {
            timeout: 2_000,
        });
        await addIsRefused();

        fireEvent.change(shareField('Cris', 'percentOf'), { target: { value: '40' } });
        expect(screen.getByRole('alert').textContent).toBe(t('groups.share.percentOver', { percent: percent(667) }));
        await addIsRefused();

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
        await addIsRefused();
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
        openSplit();
        fireEvent.click(screen.getByRole('button', { name: es.groups.share.modes.percent }));

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

    it('says what is unassigned or over, marks it once Add is pressed, and saves nothing until it adds up', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickMode('exact');

        fireEvent.change(shareField('Cris', 'amountOf'), { target: { value: '1' } });
        await waitFor(() => expect(spokenLeft()).toBe(t('groups.share.unassigned', { amount: euros(233) })), {
            timeout: 2_000,
        });
        await addIsRefused();
        expect(within(theForm()).getByRole('alert').textContent).toBe(
            t('groups.share.unassigned', { amount: euros(233) })
        );
        expect(shareField('Bea', 'amountOf').getAttribute('aria-invalid')).toBe('true');

        fireEvent.change(shareField('Cris', 'amountOf'), { target: { value: '4.83' } });
        expect(screen.getByRole('alert').textContent).toBe(t('groups.share.over', { amount: euros(150) }));
        await addIsRefused();

        fireEvent.change(shareField('Cris', 'amountOf'), { target: { value: 'x' } });
        expect(screen.getByRole('alert').textContent).toBe(share.amountInvalid);
        await addIsRefused();
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

describe('the split, folded', () => {
    it('says who it is with and how it is split beside the tabs, describing the toggle, and who paid in the toggle', async () => {
        await openHome([trip()]);

        expect(summaryLines()).toBeNull();
        fireEvent.click(forChoice(form.forShared));

        expect(splitToggle().getAttribute('aria-expanded')).toBe('false');
        expect(splitToggle().textContent).toBe(share.split + share.summary.youPaid);
        expect(summaryLines()).toEqual([
            t('groups.share.summary.with', { name: 'Trip' }),
            t('groups.share.summary.equal', { count: 3 }),
        ]);
        const summary = document.getElementById(splitToggle().getAttribute('aria-describedby') ?? '');
        expect(summary?.closest('.expense-form__top')?.contains(screen.getByRole('group', { name: form.for }))).toBe(
            true
        );
        expect(screen.queryByRole('group', { name: share.people })).toBeNull();

        fireEvent.click(splitToggle());

        expect(screen.getByRole('group', { name: share.people })).toBeDefined();
        pickOption(share.paidBy, 'Bea');
        fireEvent.click(checkbox('Cris'));
        pickMode('percent');
        expect(summaryLines()).toEqual([
            t('groups.share.summary.with', { name: 'Trip' }),
            t('groups.share.summary.percent', { count: 2 }),
        ]);
        fireEvent.click(splitToggle());
        expect(splitToggle().textContent).toBe(share.split + t('groups.share.summary.paid', { name: 'Bea' }));
    });

    it('opens on Add when what is to fix is in it, with the focus on it', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });
        pickMode('exact');
        fireEvent.change(shareField('Cris', 'amountOf'), { target: { value: '1' } });
        fireEvent.click(splitToggle());
        expect(splitToggle().getAttribute('aria-expanded')).toBe('false');

        await addIsRefused();

        expect(splitToggle().getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(shareField(you, 'amountOf'));
    });

    it("chooses how it is split by the sign of each mode, beside Who's in, the one in use pressed", async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fireEvent.click(splitToggle());

        const modes = screen.getByRole('group', { name: share.mode });
        const buttons = within(modes).getAllByRole('button');
        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
            share.modes.equal,
            share.modes.percent,
            share.modes.exact,
        ]);
        expect(buttons.map((button) => button.textContent)).toEqual(['[=]', `[${share.percentUnit}]`, '[€]']);
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
        expect(modes.closest('fieldset')).toBe(screen.getByRole('group', { name: share.people }));

        fireEvent.click(buttons[2]!);

        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
        expect(shareField('Bea', 'amountOf')).toBeDefined();
    });

    it('ends each percentage with its sign', async () => {
        await openHome([trip()]);
        fireEvent.click(forChoice(form.forShared));
        fill({ amount: '10' });

        pickMode('percent');

        const box = shareField('Bea', 'percentOf').closest('.field__box')!;
        expect(box.querySelector('.field__suffix')?.textContent).toBe(share.percentUnit);
        pickMode('exact');
        expect(shareField('Bea', 'amountOf').closest('.field__box')!.querySelector('.field__suffix')).toBeNull();
    });
});
