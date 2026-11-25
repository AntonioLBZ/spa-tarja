import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/testing/fake-api';
import { person, sampleEntry, sampleGroup, sampleSettlement } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';

import type { PendingEntry } from '@/lib/offline';
import type { SharedGroup } from '@core/groups/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups.export;
const lf = en.groups.ledger.filters;
const ef = en.expenses.filters;

let downloads: { name: string; text: string }[];

async function readBlob(blob: Blob): Promise<string> {
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
    return new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
}

function trip() {
    const group = sampleGroup({ name: 'Trip' });
    const [ana, bea] = group.members;
    const dinner = sampleEntry(group, { date: '2026-10-20' });
    const paidBack = { ...sampleSettlement(group, bea!.id, ana!.id, 1500), date: '2026-11-02', createdAt: 2 };
    return { group, ana: ana!, bea: bea!, entries: [dinner, paidBack] };
}

async function open(group: SharedGroup, entries: PendingEntry[]) {
    stubApi(createFakeApi({ groups: [group], entries }).handler);
    renderApp({ path: `/groups/${group.id}/export` });
    await screen.findByRole('heading', { level: 1, name: group.name ?? 'Bea' });
    if (entries.length > 0) await screen.findByRole('table');
}

function table() {
    return screen.getByRole('table');
}

function rowTexts() {
    return within(table())
        .getAllByRole('row')
        .map((row) => row.textContent);
}

function toggle(count = 0) {
    return screen.getByRole('button', { name: t('groups.ledger.filters.toggle', { count }) });
}

function button(name: string) {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 24, 12));
    downloads = [];
    const pending: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        value: (blob: Blob) => {
            pending.push(blob);
            return `blob:tarja-${pending.length}`;
        },
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        const blob = pending[Number(this.href.split('-').at(-1)) - 1]!;
        void readBlob(blob).then((content) => downloads.push({ name: this.download, text: content }));
    });
});

afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
});

describe('the way to the export', () => {
    it('is a link in the settings of a group, closed ones included', async () => {
        const group = sampleGroup({ closed: 'deleted' });
        stubApi(createFakeApi({ groups: [group] }).handler);
        renderApp({ path: `/groups/${group.id}/edit` });

        const link = await screen.findByRole('link', { name: en.groups.edit.exportLink });
        expect(link.getAttribute('href')).toBe(`/groups/${group.id}/export`);
        expect(screen.getByRole('heading', { level: 2, name: en.groups.edit.export })).toBeDefined();
    });
});

describe('the table of a group', () => {
    it('has a column per person, named as the group names them, and what each entry does to their balance', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        const headers = within(table())
            .getAllByRole('columnheader')
            .map((cell) => cell.textContent);
        expect(headers.slice(-2)).toEqual(['Ana', 'Bea']);
        expect(rowTexts()).toEqual([
            expect.stringContaining('Ana'),
            expect.stringMatching(/Dinner.*€40\.00\+€20\.00−€20\.00$/),
            expect.stringMatching(/Bea paid Ana.*€15\.00−€15\.00\+€15\.00$/),
            `${text.closing}+€5.00−€5.00`,
        ]);
    });

    it('says the whole group in its caption until a range is chosen', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        expect(within(table()).getByText(text.range.all)).toBeDefined();
    });

    it('opens on the balance before the first day chosen in the filters', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(ef.from), { target: { value: '2026-11-01' } });

        expect(rowTexts().slice(1)).toEqual([
            `${t('groups.export.opening', { day: 'Nov 1, 2026' })}+€20.00−€20.00`,
            expect.stringContaining('Bea paid Ana'),
            `${text.closing}+€5.00−€5.00`,
        ]);
        expect(within(table()).getByText(t('groups.export.range.from', { from: 'Nov 1, 2026' }))).toBeDefined();
    });

    it('totals what is left instead of a balance when a filter narrows more than the days', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        fireEvent.click(toggle(0));
        fireEvent.change(screen.getByLabelText(lf.kind), { target: { value: 'settlement' } });
        fireEvent.change(screen.getByLabelText(ef.from), { target: { value: '2026-10-01' } });

        expect(rowTexts().slice(1)).toEqual([expect.stringContaining('Bea paid Ana'), `${text.total}−€15.00+€15.00`]);
        expect(
            within(table()).getByText(
                `${t('groups.export.range.from', { from: 'Oct 1, 2026' })} · ${lf.kinds.settlement}`
            )
        ).toBeDefined();
        expect(toggle(2)).toBeDefined();
    });

    it('finds an entry by what it does to anybody, not only to the person', async () => {
        const group = sampleGroup();
        const [, bea] = group.members;
        const cai = person('Cai');
        const dan = person('Dan');
        group.members.push(cai, dan);
        const taxi = sampleEntry(group, {
            text: 'Taxi',
            paidBy: bea!.id,
            amountCents: 900,
            shares: [
                { memberId: bea!.id, cents: 300 },
                { memberId: cai.id, cents: 300 },
                { memberId: dan.id, cents: 300 },
            ],
        });
        await open(group, [sampleEntry(group), taxi]);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(ef.search), { target: { value: '6.00' } });

        await waitFor(() => expect(rowTexts()).toHaveLength(3));
        expect(rowTexts()[1]).toContain('Taxi');
        expect(rowTexts()[2]).toMatch(new RegExp(`^${text.total}`));

        fireEvent.change(screen.getByLabelText(ef.search), { target: { value: '3.00' } });
        await waitFor(() => expect(rowTexts()[1]).toContain('Taxi'));
    });

    it('says each filter in use in its caption, the people as the table names them', async () => {
        const { group, bea, entries } = trip();
        await open(group, entries);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(lf.paidBy), { target: { value: bea.id } });
        fireEvent.change(screen.getByLabelText(ef.search), { target: { value: 'paid' } });

        await waitFor(() =>
            expect(
                within(table()).getByText(
                    [text.range.all, t('groups.export.caption.paidBy', { name: 'Bea' }), '“paid”'].join(' · ')
                )
            ).toBeDefined()
        );
    });

    it('finds an entry by its category and by who paid it', async () => {
        const group = sampleGroup();
        const [, bea] = group.members;
        const dinner = sampleEntry(group, { text: 'Dinner', date: '2026-11-01' });
        const taxi = sampleEntry(group, {
            text: 'Taxi',
            categoryId: 'transport',
            date: '2026-11-02',
            paidBy: bea!.id,
        });
        await open(group, [dinner, taxi]);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(ef.search), { target: { value: 'food' } });
        await waitFor(() => expect(rowTexts()).toHaveLength(3));
        expect(rowTexts()[1]).toContain('Dinner');

        fireEvent.change(screen.getByLabelText(ef.search), { target: { value: 'bea' } });
        await waitFor(() => expect(rowTexts()[1]).toContain('Taxi'));
        expect(rowTexts()).toHaveLength(3);
    });

    it('says the category and whom it is with in its caption', async () => {
        const { group, bea, entries } = trip();
        await open(group, entries);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(ef.category), { target: { value: 'food' } });
        fireEvent.change(screen.getByLabelText(lf.with), { target: { value: bea.id } });

        expect(
            within(table()).getByText(
                [text.range.all, 'Food', t('groups.export.caption.with', { name: 'Bea' })].join(' · ')
            )
        ).toBeDefined();
    });

    it('gives the focus back to its button when the sheet closes and after Clear', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(lf.kind), { target: { value: 'expense' } });
        fireEvent.click(button(ef.close));
        expect(document.activeElement).toBe(toggle(1));

        fireEvent.click(button(ef.clear));
        expect(document.activeElement).toBe(toggle(0));
        expect(rowTexts()).toHaveLength(4);
    });

    it('counts only the entries that are not deleted in its status line', async () => {
        const { group, entries } = trip();
        await open(group, [...entries, sampleEntry(group, { deletedAt: 9 })]);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(lf.kind), { target: { value: 'expense' } });

        expect(screen.getAllByText(t('expenses.filters.showing', { shown: 1, total: 2 })).length).toBeGreaterThan(0);
    });

    it('is empty, with its actions off, when the first day comes after the last', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(ef.from), { target: { value: '2026-11-10' } });
        fireEvent.change(screen.getByLabelText(ef.to), { target: { value: '2026-11-01' } });

        expect(screen.getAllByText(en.expenses.list.noMatch).length).toBeGreaterThan(0);
        expect(screen.queryByText(text.empty)).toBeNull();
        expect(screen.queryByRole('table')).toBeNull();
        expect(button(text.print).disabled).toBe(true);
        expect(button(text.csv).disabled).toBe(true);
    });

    it('says when there is nothing to show, with its actions off', async () => {
        await open(sampleGroup(), []);

        expect(await screen.findByText(text.empty)).toBeDefined();
        expect(button(text.print).disabled).toBe(true);
    });

    it('reads a person merged into another as that person', async () => {
        const group = sampleGroup();
        const dummy = person('Cai', { claimed: false, mergedInto: group.members[1]!.id });
        group.members.push(dummy);
        await open(group, [sampleEntry(group, { paidBy: dummy.id })]);

        const headers = within(table())
            .getAllByRole('columnheader')
            .map((cell) => cell.textContent);
        expect(headers.slice(-2)).toEqual(['Ana', 'Bea']);
    });
});

describe('the people and the amounts of the table', () => {
    it('names nobody as You or as one who left, and a deleted account as Deleted user', async () => {
        const group = sampleGroup();
        const gone = person('', { leftAt: 5 });
        group.members.push(gone);
        await open(group, [sampleEntry(group, { paidBy: gone.id })]);

        const headers = within(table())
            .getAllByRole('columnheader')
            .map((cell) => cell.textContent);
        expect(headers.slice(-3)).toEqual(['Ana', 'Bea', en.groups.names.deleted]);
        expect(table().textContent).not.toMatch(/\(You\)|\(left\)/);
    });

    it('is titled with the other person for a friend', async () => {
        const friend = sampleGroup({ kind: 'direct', name: null });
        await open(friend, [sampleEntry(friend)]);

        expect(screen.getByRole('heading', { level: 1, name: 'Bea' })).toBeDefined();
    });

    it('reads the sign of each amount of a person aloud and colors it as the settings allow', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        const closing = within(table()).getAllByRole('row').at(-1)!;
        const [owed, owes] = [...closing.querySelectorAll('.amount')];
        expect(owed!.className).toContain('amount--in');
        expect(owes!.className).toContain('amount--out');
        expect(owed!.querySelector('[aria-hidden]')).toBeNull();
    });

    it('signs every amount of a person, also when the settings leave the sign out', async () => {
        localStorage.setItem('tarja:amounts', JSON.stringify({ sign: false }));
        const { group, entries } = trip();
        await open(group, entries);

        expect(rowTexts().at(-1)).toBe(`${text.closing}+€5.00−€5.00`);
    });

    it('scrolls sideways in a box the keyboard reaches, named by its caption', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        const region = screen.getByRole('region', { name: text.range.all });
        expect(region.tabIndex).toBe(0);
        expect(within(region).getByRole('table')).toBeDefined();
    });

    it('says the expenses could not be loaded, with its actions off, when the device never had them', async () => {
        const group = sampleGroup();
        const api = createFakeApi({ groups: [group] });
        stubApi((url, init) =>
            url.pathname.endsWith('/entries') ? new Response(null, { status: 503 }) : api.handler(url, init)
        );
        renderApp({ path: `/groups/${group.id}/export` });

        expect((await screen.findByText(en.groups.group.entriesFailed)).closest('[role="status"]')).not.toBeNull();
        expect(screen.queryByText(text.empty)).toBeNull();
        expect(button(text.print).disabled).toBe(true);
        expect(button(text.csv).disabled).toBe(true);
    });
});

describe('the actions of the table', () => {
    it('prints the page with the browser', async () => {
        const print = vi.fn();
        vi.stubGlobal('print', print);
        const { group, entries } = trip();
        await open(group, entries);

        fireEvent.click(button(text.print));

        expect(print).toHaveBeenCalledOnce();
    });

    it('downloads the same table as CSV, named after the group and the day', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        fireEvent.click(button(text.csv));
        await waitFor(() => expect(downloads).toHaveLength(1));

        expect(downloads[0]!.name).toBe('tarja-Trip-2026-11-24.csv');
        expect(downloads[0]!.text.split('\r\n').slice(0, 4)).toEqual([
            '﻿Date,Expense,Category,Paid by,Amount,Currency,Ana,Bea',
            '2026-10-20,Dinner,Food,Ana,40.00,EUR,20.00,-20.00',
            '2026-11-02,Bea paid Ana,,Bea,15.00,EUR,-15.00,15.00',
            ',Balance,,,,EUR,5.00,-5.00',
        ]);
    });

    it('downloads the total of what is left, with no opening balance, when a filter narrows the table', async () => {
        const { group, entries } = trip();
        await open(group, entries);

        fireEvent.click(toggle());
        fireEvent.change(screen.getByLabelText(lf.kind), { target: { value: 'expense' } });
        fireEvent.change(screen.getByLabelText(ef.from), { target: { value: '2026-10-01' } });
        fireEvent.click(button(ef.close));
        fireEvent.click(button(text.csv));
        await waitFor(() => expect(downloads).toHaveLength(1));

        expect(downloads[0]!.text.split('\r\n').slice(1, 3)).toEqual([
            '2026-10-20,Dinner,Food,Ana,40.00,EUR,20.00,-20.00',
            `,${text.total},,,,EUR,20.00,-20.00`,
        ]);
    });
});
