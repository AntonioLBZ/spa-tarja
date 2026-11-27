import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import {
    breakdown,
    chart,
    dates,
    expense,
    groupBy,
    open,
    pick,
    rowOf,
    rows,
    t,
    text,
    totalLine,
} from '@/lib/testing/charts';
import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/testing/groups';
import { stubLanguages } from '@/lib/testing/languages';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    stubLanguages(['en-GB']);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('the dates', () => {
    it('start at the first and the last day of the month for days', async () => {
        await open();

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
        expect((screen.getByLabelText(text.to) as HTMLInputElement).value).toBe('2026-10-31');
    });

    it('follow the grouping until the person picks some', async () => {
        await open();

        groupBy(text.group.month);

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2025-11-01');
        expect((screen.getByLabelText(text.to) as HTMLInputElement).value).toBe('2026-10-31');
    });

    it('narrow the chart to the days picked, both ends included', async () => {
        await open();

        dates('2026-10-24', '2026-10-25');

        expect(rows()).toHaveLength(2);
        expect(totalLine().textContent).toContain('€61.49');
    });

    it('can reach back to other months', async () => {
        await open();

        dates('2026-09-01', '2026-09-30');
        groupBy(text.group.month);

        expect(rows()).toHaveLength(1);
        expect(rowOf('September 2026').textContent).toContain('€7.00');
    });

    it('stay as picked when the grouping changes', async () => {
        await open();
        dates('2026-10-10', '2026-10-25');

        groupBy(text.group.week);

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-10');
        expect(rows()).toHaveLength(3);
    });

    it('offer to go back to the usual ones only once they were changed', async () => {
        await open();
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();
        dates('2026-10-24', '2026-10-25');

        fireEvent.click(screen.getByRole('button', { name: text.resetRange }));

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
        expect(rows()).toHaveLength(31);
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();
    });

    it('are refused when the start is after the end, with no chart', async () => {
        await open();

        dates('2026-10-25', '2026-10-24');

        expect((await screen.findByRole('alert')).textContent).toBe(text.rangeInvalid);
        expect(chart()).toBeNull();
        expect(screen.queryByRole('button', { name: text.showNumbers })).toBeNull();
        expect(screen.queryByRole('list', { name: text.byCategory })).toBeNull();
        expect(document.querySelector('.spending-stats__total')).toBeNull();
        expect(screen.queryByText(text.empty)).toBeNull();
        expect(screen.getByLabelText(text.from).getAttribute('aria-invalid')).toBe('true');
    });

    it('allow a single day, the same at both ends', async () => {
        await open();

        dates('2026-10-25', '2026-10-25');

        expect(screen.queryByRole('alert')).toBeNull();
        expect(rows()).toHaveLength(1);
        expect(rowOf('Oct 25').textContent).toContain('€48.99');
    });

    it('keep the chart on the last good range while a date is half typed, and go back to it when the field is left', async () => {
        await open();
        const from = screen.getByLabelText(text.from) as HTMLInputElement;

        fireEvent.change(from, { target: { value: '' } });

        expect(from.value).toBe('');
        expect(rows()).toHaveLength(31);
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();

        fireEvent.blur(from);

        expect(from.value).toBe('2026-10-01');
    });

    it('ignore the years a field passes through while one is typed, and take the day once it is whole', async () => {
        await open();
        const from = screen.getByLabelText(text.from) as HTMLInputElement;

        for (const partial of ['0002-10-05', '0020-10-05', '0202-10-05']) {
            fireEvent.change(from, { target: { value: partial } });
            expect(from.value).toBe(partial);
            expect(rows()).toHaveLength(31);
        }
        fireEvent.change(from, { target: { value: '2026-10-05' } });

        expect(rows()).toHaveLength(27);
        expect(from.value).toBe('2026-10-05');
    });

    it('ignore years that cannot be right, before 2000 and after 2099', async () => {
        await open();

        for (const day of ['1999-12-31', '2100-01-01']) {
            fireEvent.change(screen.getByLabelText(text.from), { target: { value: day } });
            expect(rows()).toHaveLength(31);
        }
        expect(screen.queryByRole('button', { name: text.resetRange })).toBeNull();
    });

    it('accept the first and the last day that can be right', async () => {
        await open();

        dates('2000-01-01', '2099-12-31');

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2000-01-01');
        expect((screen.getByLabelText(text.to) as HTMLInputElement).value).toBe('2099-12-31');
        expect(screen.getByRole('button', { name: text.resetRange })).toBeDefined();
    });

    it('are explained by the message when the start is after the end', async () => {
        await open();

        dates('2026-10-25', '2026-10-24');

        const message = await screen.findByRole('alert');
        expect(screen.getByLabelText(text.from).getAttribute('aria-describedby')).toBe(message.id);
        expect(screen.getByLabelText(text.to).getAttribute('aria-describedby')).toBe(message.id);
    });

    it('are explained by nothing when they are fine', async () => {
        await open();

        expect(screen.getByLabelText(text.from).getAttribute('aria-describedby')).toBeNull();
    });

    it('are refused when the range would make too many rows, but the total and the split stay', async () => {
        await open();

        dates('2020-01-01', '2026-10-31');

        const message = await screen.findByRole('alert');
        expect(message.textContent).toBe(text.rangeTooLong);
        expect(chart()).toBeNull();
        expect(screen.queryByRole('button', { name: text.showNumbers })).toBeNull();
        expect(totalLine().textContent).toContain('€96.49');
        expect(breakdown()).toHaveLength(3);
        expect(screen.getByLabelText(text.from).getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByLabelText(text.from).getAttribute('aria-describedby')).toBe(message.id);
    });

    it('drop a half typed date along with the others when they are reset', async () => {
        await open();
        dates('2026-10-24', '2026-10-25');
        fireEvent.change(screen.getByLabelText(text.from), { target: { value: '0002-10-24' } });

        fireEvent.click(screen.getByRole('button', { name: text.resetRange }));

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
    });

    it('can still be drawn by month when it is too long to draw by day', async () => {
        await open();
        dates('2020-01-01', '2026-10-31');

        groupBy(text.group.month);

        expect(screen.queryByRole('alert')).toBeNull();
        expect(rows()).toHaveLength(82);
    });

    it('change only the end that was picked', async () => {
        await open();

        fireEvent.change(screen.getByLabelText(text.to), { target: { value: '2026-10-20' } });

        expect((screen.getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-10-01');
        expect((screen.getByLabelText(text.to) as HTMLInputElement).value).toBe('2026-10-20');
    });

    it('are not complained about when they are fine', async () => {
        await open();

        expect(screen.queryByRole('alert')).toBeNull();
        expect(screen.getByLabelText(text.from).getAttribute('aria-invalid')).toBe('false');
    });
});

describe('your part of the shared expenses', () => {
    it('is in the columns and the total on the day it was made, and a settlement is not', async () => {
        const ana = person('Ana', { role: 'owner' });
        const bea = person('Bea');
        const group = sampleGroup({ members: [ana, bea], me: ana.id });
        await open([], {
            groups: [group],
            entries: [
                sampleEntry(group, { paidBy: bea.id, date: '2026-10-24', payment: 'credit', chargeDate: '2026-11-02' }),
                sampleSettlement(group, ana.id, bea.id, 2000),
            ],
        });

        await waitFor(() => expect(rowOf('Oct 24').textContent).toContain('€20.00'));
        expect(totalLine().textContent).toContain('€20.00');
    });
});

describe('the expenses the chart counts', () => {
    function section() {
        return screen.getByRole('heading', { name: text.expensesTitle, level: 2 }).closest('section')!;
    }

    function tickets() {
        return [...section().querySelectorAll('.sheet')].map((sheet) => ({
            label: sheet.querySelector('h3')!.textContent,
            rows: [...sheet.querySelectorAll('li')].map((row) => row.textContent),
            total: sheet.querySelector('.counted-expenses__subtotal')!.textContent,
        }));
    }

    it('lists them under the chart on a ticket per row, newest first, each adding up to its column', async () => {
        await open();

        expect(tickets().map((ticket) => [ticket.label, ticket.total])).toEqual([
            ['Sun, Oct 25', '€48.99'],
            ['Sat, Oct 24', '€12.50'],
            ['Sat, Oct 10', '€20.00'],
            ['Fri, Oct 2', '€8.00'],
        ]);
        expect(rowOf('Oct 25').textContent).toContain('€48.99');
        expect(tickets()[0]!.rows).toHaveLength(2);
    });

    it('lists a credit card expense on the day it is charged, saying the day it was made', async () => {
        await open();

        const credit = tickets().find((ticket) => ticket.label === 'Fri, Oct 2')!;
        expect(credit.rows[0]).toContain('Sep 20');
        expect(credit.rows[0]).toContain('€8.00');
    });

    it('lists only the category picked', async () => {
        await open();

        pick(en.categories.food);

        expect(tickets().map((ticket) => ticket.total)).toEqual(['€3.00', '€12.50']);
    });

    it('groups them by week and by month, saying the day each was made', async () => {
        await open();

        groupBy(text.group.month);

        expect(tickets().map((ticket) => ticket.label)).toEqual(['October 2026', 'September 2026']);
        expect(tickets()[1]!.rows[0]).toContain('Sep 30');
    });

    it('shows a part of a plan as the part it is', async () => {
        const plan = { id: crypto.randomUUID(), part: 3, parts: 12 };
        await open([
            expense({
                text: 'Laptop',
                amountCents: 4000,
                date: '2026-10-05',
                payment: 'credit',
                chargeDate: '2026-10-05',
                plan,
            }),
        ]);

        expect(tickets()[0]!.rows[0]).toContain(t('expenses.list.part', { part: 3, parts: 12 }));
    });

    it('opens nothing: the rows only read', async () => {
        await open();

        expect(within(section()).queryAllByRole('button')).toHaveLength(0);
    });

    it('lists your part of a shared expense with its group, and never a settlement', async () => {
        const ana = person('Ana', { role: 'owner' });
        const bea = person('Bea');
        const group = sampleGroup({ members: [ana, bea], me: ana.id });
        await open([], {
            groups: [group],
            entries: [
                sampleEntry(group, { paidBy: bea.id, date: '2026-10-24' }),
                sampleSettlement(group, ana.id, bea.id, 2000),
            ],
        });

        await waitFor(() => expect(tickets()).toHaveLength(1));
        expect(tickets()[0]!.rows).toHaveLength(1);
        expect(tickets()[0]!.rows[0]).toContain(group.name);
    });

    it('draws a hundred rows, and Show more brings the next ones and takes the focus to the first of them', async () => {
        await open(
            Array.from({ length: 130 }, (_, index) =>
                expense({ amountCents: 100, date: '2026-10-20', createdAt: 1_000 + index, text: `Item ${index}` })
            )
        );

        expect(tickets()[0]!.rows).toHaveLength(100);
        expect(tickets()[0]!.total).toBe('€130.00');

        fireEvent.click(within(section()).getByRole('button', { name: text.showMore }));

        expect(tickets()[0]!.rows).toHaveLength(130);
        expect(document.activeElement!.textContent).toContain('Item 29');
        expect(within(section()).queryByRole('button', { name: text.showMore })).toBeNull();
    });

    it('is not there when nothing was spent or the dates are refused', async () => {
        await open();

        dates('2026-10-11', '2026-10-12');
        expect(screen.queryByRole('heading', { name: text.expensesTitle })).toBeNull();

        dates('2026-10-25', '2026-10-24');
        expect(screen.queryByRole('heading', { name: text.expensesTitle })).toBeNull();
    });

    it('starts over at a hundred rows when the category changes', async () => {
        await open(
            Array.from({ length: 260 }, (_, index) =>
                expense({ amountCents: 100, date: '2026-10-20', createdAt: 1_000 + index, text: `Item ${index}` })
            )
        );
        fireEvent.click(within(section()).getByRole('button', { name: text.showMore }));
        expect(tickets()[0]!.rows).toHaveLength(200);

        pick(en.categories.food);

        expect(tickets()[0]!.rows).toHaveLength(100);
    });

    it('stays for a range too long to draw', async () => {
        await open();

        dates('2020-01-01', '2026-10-31');

        expect(chart()).toBeNull();
        expect(tickets().length).toBeGreaterThan(0);
    });

    it('files an expense whose category is gone under the fallback, as the split does', async () => {
        await open([expense({ categoryId: 'gone-category', amountCents: 800, date: '2026-10-20' })]);

        await waitFor(() => expect(breakdown()[0]!.textContent).toContain(en.categories.other));
        expect(tickets()[0]!.rows[0]).toContain(en.categories.other);
        expect(tickets()[0]!.total).toBe('€8.00');
    });

    it('says who paid a shared expense', async () => {
        const ana = person('Ana', { role: 'owner' });
        const bea = person('Bea');
        const group = sampleGroup({ members: [ana, bea], me: ana.id });
        await open([], { groups: [group], entries: [sampleEntry(group, { paidBy: bea.id, date: '2026-10-24' })] });

        await waitFor(() => expect(tickets()).toHaveLength(1));
        expect(tickets()[0]!.rows[0]).toContain('Bea');
    });
});
