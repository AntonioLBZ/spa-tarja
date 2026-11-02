import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';

import type { PendingEntry } from '@/lib/offline';
import type { Handler } from '@/lib/test/render-app';
import type { GroupMember, SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups.close;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');
const cris = person('Cris', { claimed: false });

function trip(me: GroupMember, overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ name: 'Lisbon', members: [ana, bea, cris], me: me.id, ...overrides });
}

function owed(group: SharedGroup, debtor: GroupMember) {
    return sampleEntry(group, {
        paidBy: ana.id,
        amountCents: 2000,
        shares: [
            { memberId: ana.id, cents: 1000 },
            { memberId: debtor.id, cents: 1000 },
        ],
    });
}

async function edit(group: SharedGroup, entries: PendingEntry[] = [], wrap?: (handler: Handler) => Handler) {
    const api = createFakeApi({ groups: [group], entries });
    stubApi(wrap ? wrap(api.handler) : api.handler);
    renderApp({ path: `/groups/${group.id}/edit` });
    await screen.findByRole('checkbox', { name: en.groups.edit.show });
    return { api, saved: () => api.groups[0]! };
}

function button(name: string) {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

async function closedRows() {
    await screen.findByRole('heading', { level: 1, name: en.groups.title });
    fireEvent.click(await screen.findByRole('button', { name: en.groups.lists.closed }));
    return within(button(en.groups.lists.closed).closest('.disclosure')!)
        .getAllByRole('link')
        .map((row) => row.textContent);
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('leaving', () => {
    it('asks first, saying what happens, with the focus on Cancel, which gives it back', async () => {
        const { api } = await edit(trip(bea));

        fireEvent.click(button(text.leave.button));

        expect(screen.getByText(t('groups.close.leave.question', { name: 'Lisbon' }))).toBeDefined();
        expect(screen.getByText(text.leave.what)).toBeDefined();
        expect(document.activeElement).toBe(button(text.cancel));

        fireEvent.click(button(text.cancel));

        expect(screen.queryByText(text.leave.what)).toBeNull();
        expect(document.activeElement).toBe(button(text.leave.button));
        expect(api.groupRequests).toEqual([]);
    });

    it('opens Groups once it has left, with the group among the closed ones', async () => {
        const { saved } = await edit(trip(bea));

        fireEvent.click(button(text.leave.button));
        fireEvent.click(button(text.leave.confirm));

        expect(await closedRows()).toEqual([`Lisbon${en.groups.row.left}${en.groups.row.shown}`]);
        expect(saved().closed).toBe('left');
    });

    it('says to settle up first, with the way to do it, when your balance is not zero', async () => {
        const group = trip(bea);
        const { api } = await edit(group, [owed(group, bea)]);
        await screen.findByText(t('groups.balance.owe', { amount: euros(1000) }));

        fireEvent.click(button(text.leave.button));

        expect(screen.getByText(t('groups.close.leave.unsettled', { name: 'Lisbon' }))).toBeDefined();
        expect(screen.queryByRole('button', { name: text.leave.confirm })).toBeNull();
        expect(screen.getByRole('link', { name: text.settleUp }).getAttribute('href')).toBe(`/groups/${group.id}`);
        expect(document.activeElement).toBe(button(text.cancel));
        expect(api.groupRequests).toEqual([]);
    });

    it('says to settle up first when the server finds a balance the device did not', async () => {
        const { api } = await edit(trip(bea));
        api.state.groupRefusal = { status: 409, error: 'unsettled' };

        fireEvent.click(button(text.leave.button));
        fireEvent.click(button(text.leave.confirm));

        expect(await screen.findByText(t('groups.close.leave.unsettled', { name: 'Lisbon' }))).toBeDefined();
        expect(screen.getByRole('link', { name: text.settleUp })).toBeDefined();
    });

    it('does not leave while the changes of the group cannot be pulled, and says why', async () => {
        let pullFails = false;
        const { api } = await edit(trip(bea), [], (handler) => (url, init) => {
            if (pullFails && url.pathname.endsWith('/entries')) return new Response(null, { status: 503 });
            return handler(url, init);
        });
        pullFails = true;

        fireEvent.click(button(text.leave.button));
        fireEvent.click(button(text.leave.confirm));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.unsynced);
        expect(api.groupRequests).toEqual([]);
        expect(screen.getByRole('heading', { level: 1, name: t('groups.edit.title', { name: 'Lisbon' }) }));
    });

    it('says in words that the owner cannot leave, when the server says so', async () => {
        const { api } = await edit(trip(bea));
        api.state.groupRefusal = { status: 409, error: 'owner' };

        fireEvent.click(button(text.leave.button));
        fireEvent.click(button(text.leave.confirm));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.ownerLeaves);
    });

    it('is not offered to the owner, who deletes instead', async () => {
        await edit(trip(ana));

        expect(screen.queryByRole('button', { name: text.leave.button })).toBeNull();
        expect(button(text.delete.button)).toBeDefined();
    });
});

describe('deleting', () => {
    it('asks first, then opens Groups with the group among the closed ones', async () => {
        const { saved } = await edit(trip(ana));

        fireEvent.click(button(text.delete.button));

        expect(screen.getByText(t('groups.close.delete.question', { name: 'Lisbon' }))).toBeDefined();
        expect(screen.getByText(text.delete.what)).toBeDefined();
        expect(document.activeElement).toBe(button(text.cancel));

        fireEvent.click(button(text.delete.confirm));

        expect(await closedRows()).toEqual([`Lisbon${en.groups.row.deleted}${en.groups.row.shown}`]);
        expect(saved().closed).toBe('deleted');
    });

    it('says to settle up first while another person who uses the app has a balance', async () => {
        const group = trip(ana);
        await edit(group, [owed(group, bea)]);
        await screen.findByText(t('groups.balance.memberOwes', { name: 'Bea', amount: euros(1000) }));

        fireEvent.click(button(text.delete.button));

        expect(screen.getByText(t('groups.close.delete.unsettled', { name: 'Lisbon' }))).toBeDefined();
        expect(screen.queryByRole('button', { name: text.delete.confirm })).toBeNull();
    });

    it('asks when nobody else who uses the app is still in it, whatever the balances', async () => {
        const group = trip(ana, { members: [ana, person('Bea', { leftAt: 1 }), cris] });
        await edit(group, [owed(group, cris)]);
        await screen.findByText(t('groups.balance.memberOwes', { name: 'Cris', amount: euros(1000) }));

        fireEvent.click(button(text.delete.button));

        expect(button(text.delete.confirm)).toBeDefined();
    });

    it('is not offered to a member who is not the owner', async () => {
        await edit(trip(bea));

        expect(screen.queryByRole('button', { name: text.delete.button })).toBeNull();
    });
});

describe('removing a friend', () => {
    it('asks in the words of a friend, then shows the friend among the closed ones', async () => {
        const friend = sampleGroup({ kind: 'direct', name: null, members: [ana, cris], me: ana.id });
        await edit(friend);

        expect(screen.queryByRole('button', { name: text.leave.button })).toBeNull();
        fireEvent.click(button(text.deleteFriend.button));

        expect(screen.getByText(t('groups.close.deleteFriend.question', { name: 'Cris' }))).toBeDefined();
        expect(screen.getByText(text.deleteFriend.what)).toBeDefined();

        fireEvent.click(button(text.deleteFriend.confirm));

        expect(await closedRows()).toEqual([`Cris${en.groups.row.deletedFriend}${en.groups.row.shown}`]);
    });
});

describe('where there is nothing to close', () => {
    it('offers none of them in a closed group', async () => {
        await edit(trip(bea, { closed: 'deleted' }));

        for (const way of [text.leave, text.delete, text.deleteFriend]) {
            expect(screen.queryByRole('button', { name: way.button })).toBeNull();
        }
    });

    it('turns them off without a connection', async () => {
        await edit(trip(bea));

        onlineManager.setOnline(false);

        await screen.findByText(en.groups.offline);
        expect(button(text.leave.button).disabled).toBe(true);
    });
});
