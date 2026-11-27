import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import {
    chosenInstallments,
    deleteExpense,
    expense,
    field,
    installmentsLabel,
    pickInstallments,
    pickPayment,
    shown,
    t,
    TODAY,
} from '@/lib/testing/expenses';
import { createFakeApi } from '@/lib/testing/fake-api';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { optionNames } from '@/lib/testing/select';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('installments', () => {
    const partLabel = (part: number, parts: number, day: string) =>
        t('expenses.form.part', { part, parts, date: shown(day) });
    const partField = (part: number, parts: number, day: string) => field(partLabel(part, parts, day));
    const DAYS = ['2026-10-25', '2026-11-25', '2026-12-25'];
    const submit = () => screen.getByRole('button', { name: en.expenses.form.submit }) as HTMLButtonElement;
    const typeAmount = (value: string) => fireEvent.change(field(en.expenses.form.amount), { target: { value } });
    const typeText = (value: string) => fireEvent.change(field(en.expenses.form.text), { target: { value } });

    async function open(options: Parameters<typeof createFakeApi>[0] = {}) {
        const api = createFakeApi(options);
        stubApi(api.handler);
        renderApp();
        await screen.findByText(en.expenses.list.empty);
        return api;
    }

    it('are one payment unless the person asks for more, with no parts to fill in', async () => {
        await open();

        expect(chosenInstallments()).toBe(installmentsLabel(1));
        expect(optionNames(en.expenses.form.installments)).toEqual(
            Array.from({ length: 12 }, (_, index) => installmentsLabel(index + 1))
        );
        expect(screen.getAllByRole('textbox')).toHaveLength(2);
    });

    it('are only for what is paid at once: a credit or restaurant card has its own charge date', async () => {
        await open();
        pickPayment('credit');

        expect(screen.queryByLabelText(en.expenses.form.installments)).toBeNull();
    });

    it('split the amount evenly, a part for each month, the remainder going to the first ones', async () => {
        await open();
        typeAmount('15.01');

        pickInstallments(3);

        expect(partField(1, 3, DAYS[0]!).value).toBe('5.01');
        expect(partField(2, 3, DAYS[1]!).value).toBe('5.00');
        expect(partField(3, 3, DAYS[2]!).value).toBe('5.00');
        expect(screen.queryByText(/Remaining/)).toBeNull();
    });

    it('split again when the total changes', async () => {
        await open();
        typeAmount('15');
        pickInstallments(3);
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '9' } });

        typeAmount('30');

        expect(partField(1, 3, DAYS[0]!).value).toBe('10.00');
    });

    it('split again when the number of payments changes', async () => {
        await open();
        typeAmount('15');
        pickInstallments(3);
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '9' } });

        pickInstallments(2);

        expect(partField(1, 2, DAYS[0]!).value).toBe('7.50');
        expect(partField(2, 2, DAYS[1]!).value).toBe('7.50');
    });

    it('keep what was typed when the total is only written another way', async () => {
        await open();
        typeAmount('15');
        pickInstallments(3);
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '9' } });

        typeAmount('15.00');

        expect(partField(1, 3, DAYS[0]!).value).toBe('9');
    });

    it('follow the day of the purchase', async () => {
        await open();
        typeAmount('15');
        pickInstallments(2);

        fireEvent.change(field(en.expenses.form.date), { target: { value: '2026-01-31' } });

        expect(partField(1, 2, '2026-01-31').value).toBe('7.50');
        expect(partField(2, 2, '2026-02-28').value).toBe('7.50');
    });

    it('say what is left to assign, and do not save until the parts add up', async () => {
        const api = await open();
        typeAmount('15');
        pickInstallments(3);

        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '4' } });

        const hint = screen.getByText(t('expenses.form.remaining', { amount: '€1.00' }), { selector: 'p' });
        expect(hint.classList.contains('field__hint')).toBe(true);
        const spoken = document.querySelector('dialog [role="status"].visually-hidden')!;
        await waitFor(() => expect(spoken.textContent).toBe(t('expenses.form.remaining', { amount: '€1.00' })), {
            timeout: 2_000,
        });
        expect(submit().disabled).toBe(false);
        fireEvent.click(submit());
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.writes).toHaveLength(0);
        expect(screen.getByRole('alert').textContent).toBe(t('expenses.form.remaining', { amount: '€1.00' }));
        expect(partField(1, 3, DAYS[0]!).getAttribute('aria-invalid')).toBe('true');
        expect(partField(3, 3, DAYS[2]!).getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(partField(1, 3, DAYS[0]!));
    });

    it('refuse parts that go over the total', async () => {
        const api = await open();
        typeAmount('15');
        pickInstallments(3);

        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '6' } });

        expect((await screen.findByRole('alert')).textContent).toBe(t('expenses.form.over', { amount: '€1.00' }));
        fireEvent.click(submit());
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.writes).toHaveLength(0);
        expect(document.activeElement).toBe(partField(1, 3, DAYS[0]!));
    });

    it('refuse a part that is not an amount above zero', async () => {
        const api = await open();
        typeAmount('10');
        pickInstallments(2);

        fireEvent.change(partField(1, 2, DAYS[0]!), { target: { value: '10' } });
        fireEvent.change(partField(2, 2, DAYS[1]!), { target: { value: '0' } });

        expect((await screen.findByRole('alert')).textContent).toBe(en.expenses.form.partInvalid);
        expect(partField(2, 2, DAYS[1]!).getAttribute('aria-invalid')).toBe('true');
        fireEvent.click(submit());
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(api.writes).toHaveLength(0);
        expect(document.activeElement).toBe(partField(2, 2, DAYS[1]!));
    });

    it('add up again once the parts are fixed', async () => {
        const api = await open();
        typeAmount('15');
        pickInstallments(3);
        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '4' } });
        fireEvent.click(submit());
        expect(screen.getByRole('alert').textContent).toBe(t('expenses.form.remaining', { amount: '€1.00' }));

        fireEvent.change(partField(2, 3, DAYS[1]!), { target: { value: '6' } });

        expect(screen.queryByText(/Remaining/)).toBeNull();
        expect(partField(1, 3, DAYS[0]!).getAttribute('aria-invalid')).toBe('false');
        fireEvent.click(submit());
        await waitFor(() => expect(api.writes).toHaveLength(3));
    });

    it('are saved as one expense for each part, linked as a plan, each counting in its own month', async () => {
        const api = await open();
        typeAmount('15.01');
        typeText('Sofa');
        pickInstallments(3);

        fireEvent.click(submit());

        await waitFor(() => expect(api.writes).toHaveLength(3));
        const planIds = new Set(api.writes.map((write) => write.plan?.id));
        expect(planIds.size).toBe(1);
        expect(new Set(api.writes.map((write) => write.id)).size).toBe(3);
        expect(
            api.writes.map((write) => [write.plan?.part, write.plan?.parts, write.amountCents, write.chargeDate])
        ).toEqual([
            [1, 3, 501, DAYS[0]],
            [2, 3, 500, DAYS[1]],
            [3, 3, 500, DAYS[2]],
        ]);
        const now = Date.now();
        for (const write of api.writes) {
            expect(write).toMatchObject({
                text: 'Sofa',
                categoryId: 'other',
                date: TODAY,
                payment: 'direct',
                createdAt: now,
                updatedAt: now,
                deletedAt: null,
            });
        }
    });

    it('are saved with the amounts the person set', async () => {
        const api = await open();
        typeAmount('15');
        pickInstallments(3);
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '5' } });
        fireEvent.change(partField(2, 3, DAYS[1]!), { target: { value: '6' } });
        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '4' } });

        fireEvent.click(submit());

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(api.writes.map((write) => write.amountCents)).toEqual([500, 600, 400]);
    });

    it('are left out when the expense is deferred after all', async () => {
        const api = await open();
        typeAmount('15');
        pickInstallments(3);

        pickPayment('credit');
        fireEvent.click(submit());

        await waitFor(() => expect(api.writes).toHaveLength(1));
        expect(api.writes[0]).toMatchObject({
            amountCents: 1500,
            payment: 'credit',
            chargeDate: '2026-11-25',
            plan: null,
        });
    });

    it('come back when the expense is paid at once again', async () => {
        await open();
        typeAmount('15');
        pickInstallments(3);
        pickPayment('credit');

        pickPayment('direct');

        expect(chosenInstallments()).toBe(installmentsLabel(3));
        expect(partField(3, 3, DAYS[2]!).value).toBe('5.00');
    });

    it('start from an even split again for the next expense, whatever was typed in the last one', async () => {
        const api = await open();
        typeAmount('15');
        pickInstallments(3);
        fireEvent.change(partField(1, 3, DAYS[0]!), { target: { value: '6' } });
        fireEvent.change(partField(2, 3, DAYS[1]!), { target: { value: '5' } });
        fireEvent.change(partField(3, 3, DAYS[2]!), { target: { value: '4' } });
        fireEvent.click(submit());
        await waitFor(() => expect(api.writes).toHaveLength(3));

        typeAmount('15');
        pickInstallments(3);

        expect(partField(1, 3, DAYS[0]!).value).toBe('5.00');
        expect(partField(3, 3, DAYS[2]!).value).toBe('5.00');
    });

    it('go back to one payment after a plan is saved', async () => {
        await open();
        typeAmount('15');
        pickInstallments(3);

        fireEvent.click(submit());
        await screen.findByRole('listitem');

        expect(chosenInstallments()).toBe(installmentsLabel(1));
        expect(field(en.expenses.form.amount).value).toBe('');
    });

    it('show in the list as one expense with the total and where the plan ends', async () => {
        const plan = crypto.randomUUID();
        const parts = DAYS.map((day, index) =>
            expense({
                text: 'Sofa',
                amountCents: 500 + index,
                payment: 'direct',
                chargeDate: day,
                plan: { id: plan, part: index + 1, parts: 3 },
            })
        );
        stubApi(createFakeApi({ expenses: [...parts.toReversed(), expense({ text: 'Coffee' })] }).handler);

        renderApp();

        const row = (await screen.findByText('Sofa')).closest('li')!;
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(row.textContent).toContain('€15.03');
        expect(row.textContent).toContain(t('expenses.list.plan', { parts: 3, date: shown(DAYS[2]!) }));
    });

    it('are marked as not synced when only one of the parts is waiting', async () => {
        const plan = crypto.randomUUID();
        const parts = DAYS.map((day, index) =>
            expense({ text: 'Sofa', chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        const api = createFakeApi({ expenses: parts });
        stubApi(api.handler);
        const { outbox } = renderApp();
        await screen.findByText(t('expenses.list.plan', { parts: 3, date: shown(DAYS[2]!) }));
        const row = screen.getByText('Sofa').closest('li')!;
        expect(within(row).queryByText(en.expenses.list.pending)).toBeNull();
        api.state.writeStatus = 503;

        await outbox.put({ ...parts[1]!, updatedAt: 2_000 });

        expect(await within(row).findByText(en.expenses.list.pending)).toBeDefined();
    });

    it('are deleted together from the list', async () => {
        const plan = crypto.randomUUID();
        const parts = DAYS.map((day, index) =>
            expense({ text: 'Sofa', chargeDate: day, plan: { id: plan, part: index + 1, parts: 3 } })
        );
        const api = createFakeApi({ expenses: parts });
        stubApi(api.handler);
        renderApp();
        await screen.findByText('Sofa');

        deleteExpense('Sofa');

        await waitFor(() => expect(api.writes).toHaveLength(3));
        expect(api.writes.every((write) => write.deletedAt !== null)).toBe(true);
        await waitFor(() => expect(screen.queryByText('Sofa')).toBeNull());
    });

    it('wait as one expense, with every part, until the connection is back', async () => {
        const api = await open();
        onlineManager.setOnline(false);
        typeAmount('15');
        typeText('Sofa');
        pickInstallments(3);

        fireEvent.click(submit());

        const row = await screen.findByRole('listitem');
        expect(within(row).getAllByText(en.expenses.list.pending)).toHaveLength(1);
        expect(screen.getByText(t('sync.pending', { count: 3 }))).toBeDefined();
        expect(api.attempts).toHaveLength(0);

        onlineManager.setOnline(true);

        await waitFor(() => expect(api.writes).toHaveLength(3));
        await waitFor(() => expect(screen.queryByText(en.expenses.list.pending)).toBeNull());
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
    });
});
