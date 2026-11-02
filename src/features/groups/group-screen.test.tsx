import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { leaveCopy, person, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';

import type { PendingEntry } from '@/lib/offline';
import type { GroupMember, SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

function groupOf(members: GroupMember[], me: GroupMember, overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ members, me: me.id, ...overrides });
}

function expense(group: SharedGroup, payer: GroupMember, shares: Array<[GroupMember, number]>) {
    return sampleEntry(group, {
        paidBy: payer.id,
        amountCents: shares.reduce((sum, [, cents]) => sum + cents, 0),
        shares: shares.map(([member, cents]) => ({ memberId: member.id, cents })),
    });
}

function open(groups: SharedGroup[], entries: PendingEntry[] = [], path = `/groups/${groups[0]!.id}`) {
    const api = createFakeApi({ groups, entries });
    stubApi(api.handler);
    return { api, app: renderApp({ path }) };
}

function balancesSheet() {
    return screen.getByRole('heading', { name: text.debts.label }).closest('section')!;
}

function debtLines() {
    return within(balancesSheet())
        .getAllByRole('listitem')
        .map((line) => line.firstChild?.textContent);
}

function everyone() {
    fireEvent.click(screen.getByRole('button', { name: text.debts.everyone }));
    return within(screen.getByRole('list', { name: text.debts.everyone }))
        .getAllByRole('listitem')
        .map((line) => line.textContent);
}

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');
const cris = person('Cris');

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('a group', () => {
    it('is titled by its name and says what you are owed', async () => {
        const group = groupOf([ana, bea], ana, { name: 'Lisbon' });
        open(
            [group],
            [
                expense(group, ana, [
                    [ana, 2000],
                    [bea, 2000],
                ]),
            ]
        );

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
        expect(await screen.findByText(t('groups.balance.owed', { amount: euros(2000) }))).toBeDefined();
    });

    it('says what you owe', async () => {
        const group = groupOf([ana, bea], ana);
        open(
            [group],
            [
                expense(group, bea, [
                    [ana, 1250],
                    [bea, 1250],
                ]),
            ]
        );

        expect(await screen.findByText(t('groups.balance.owe', { amount: euros(1250) }))).toBeDefined();
        expect(debtLines()).toEqual([t('groups.debts.youOwe', { name: 'Bea', amount: euros(1250) })]);
    });

    it('says all is settled when nobody owes anything', async () => {
        const group = groupOf([ana, bea], ana);
        open([group]);

        expect(await screen.findByText(text.balance.allSettled)).toBeDefined();
        expect(within(balancesSheet()).getByText(text.debts.none)).toBeDefined();
    });

    it('lists who owes whom pair by pair, the debts that are yours first', async () => {
        const group = groupOf([bea, cris, ana], ana);
        open(
            [group],
            [
                expense(group, bea, [
                    [bea, 1500],
                    [cris, 1500],
                ]),
                expense(group, ana, [
                    [ana, 2000],
                    [bea, 2000],
                ]),
            ]
        );

        await screen.findByText(t('groups.balance.owed', { amount: euros(2000) }));
        expect(debtLines()).toEqual([
            t('groups.debts.owesYou', { name: 'Bea', amount: euros(2000) }),
            t('groups.debts.owes', { from: 'Cris', to: 'Bea', amount: euros(1500) }),
        ]);
    });

    it('lists what each member is owed or owes under the debts, closed until asked', async () => {
        const group = groupOf([bea, cris, ana], ana);
        open(
            [group],
            [
                expense(group, bea, [
                    [bea, 1500],
                    [cris, 1500],
                ]),
                expense(group, ana, [
                    [ana, 2000],
                    [bea, 2000],
                ]),
            ]
        );
        await screen.findByText(t('groups.balance.owed', { amount: euros(2000) }));

        expect(screen.getByRole('button', { name: text.debts.everyone }).getAttribute('aria-expanded')).toBe('false');
        expect(everyone()).toEqual([
            t('groups.balance.memberOwes', { name: 'Bea', amount: euros(500) }),
            t('groups.balance.memberOwes', { name: 'Cris', amount: euros(1500) }),
            t('groups.balance.owed', { amount: euros(2000) }),
        ]);
    });

    it('says you are settled in your own line of everyone', async () => {
        const group = groupOf([ana, bea, cris], ana);
        open(
            [group],
            [
                expense(group, bea, [
                    [bea, 1000],
                    [cris, 1000],
                ]),
            ]
        );
        await screen.findByText(text.balance.allSettled);

        expect(everyone()).toEqual([
            text.balance.youSettled,
            t('groups.balance.memberOwed', { name: 'Bea', amount: euros(1000) }),
            t('groups.balance.memberOwes', { name: 'Cris', amount: euros(1000) }),
        ]);
    });

    it('names who left and who deleted their account', async () => {
        const gone = person('Bea', { leftAt: 1 });
        const deleted = person('');
        const group = groupOf([ana, gone, deleted, cris], ana);
        open(
            [group],
            [
                expense(group, ana, [
                    [ana, 1000],
                    [gone, 1000],
                    [deleted, 1000],
                ]),
            ]
        );
        await screen.findByText(t('groups.balance.owed', { amount: euros(2000) }));

        const left = t('groups.names.left', { name: 'Bea' });
        expect(debtLines()).toEqual([
            t('groups.debts.owesYou', { name: left, amount: euros(1000) }),
            t('groups.debts.owesYou', { name: text.names.deleted, amount: euros(1000) }),
        ]);
        expect(everyone()).toEqual([
            t('groups.balance.owed', { amount: euros(2000) }),
            t('groups.balance.memberOwes', { name: left, amount: euros(1000) }),
            t('groups.balance.memberOwes', { name: text.names.deleted, amount: euros(1000) }),
            t('groups.balance.memberSettled', { name: 'Cris' }),
        ]);
    });

    it('tells apart two members with the same name', async () => {
        const twin = person('bea');
        const group = groupOf([ana, bea, twin], ana);
        open(
            [group],
            [
                expense(group, ana, [
                    [ana, 1000],
                    [bea, 1000],
                    [twin, 1000],
                ]),
            ]
        );
        await screen.findByText(t('groups.balance.owed', { amount: euros(2000) }));

        expect(debtLines()).toEqual([
            t('groups.debts.owesYou', { name: 'Bea', amount: euros(1000) }),
            t('groups.debts.owesYou', {
                name: t('groups.names.numbered', { name: 'bea', number: 2 }),
                amount: euros(1000),
            }),
        ]);
    });

    it('reads a merged dummy as the member it was merged into', async () => {
        const dummy = person('Bee', { claimed: false, mergedInto: bea.id, leftAt: 1 });
        const group = groupOf([ana, bea, dummy], ana);
        open(
            [group],
            [
                expense(group, ana, [
                    [ana, 1000],
                    [dummy, 1000],
                ]),
            ]
        );

        expect(await screen.findByText(t('groups.balance.owed', { amount: euros(1000) }))).toBeDefined();
        expect(debtLines()).toEqual([t('groups.debts.owesYou', { name: 'Bea', amount: euros(1000) })]);
    });

    it('is titled by the name of the other person when it is a friend', async () => {
        const friend = groupOf([ana, bea], ana, { kind: 'direct', name: null });
        open([friend]);

        expect(await screen.findByRole('heading', { level: 1, name: 'Bea' })).toBeDefined();
    });
});

describe('the sync of a group', () => {
    it('asks the server for the expenses of that group only', async () => {
        const lisbon = groupOf([ana, bea], ana, { name: 'Lisbon' });
        const porto = groupOf([ana, bea], ana, { name: 'Porto' });
        const rome = groupOf([ana, bea], ana, { name: 'Rome' });
        const { api } = open(
            [lisbon, porto, rome],
            [
                expense(lisbon, ana, [
                    [ana, 2000],
                    [bea, 2000],
                ]),
            ]
        );

        await screen.findByText(t('groups.balance.owed', { amount: euros(2000) }));

        expect(api.requests.filter((request) => request.includes('/entries'))).toEqual([
            expect.stringContaining(`/api/groups/${lisbon.id}/entries`),
        ]);
    });
});

describe('a closed group', () => {
    it.each([
        ['deleted', 'group', text.group.closed.deleted],
        ['left', 'group', text.group.closed.left],
        ['deleted', 'direct', text.group.closed.deletedFriend],
    ] as const)('says why it is closed (%s, %s) and keeps its balances', async (closed, kind, notice) => {
        const group = groupOf([ana, bea], ana, { closed, kind, name: kind === 'group' ? 'Trip' : null });
        open(
            [group],
            [
                expense(group, ana, [
                    [ana, 2000],
                    [bea, 2000],
                ]),
            ]
        );

        expect(await screen.findByText(notice)).toBeDefined();
        expect(await screen.findByText(t('groups.balance.owed', { amount: euros(2000) }))).toBeDefined();
        expect(debtLines()).toEqual([t('groups.debts.owesYou', { name: 'Bea', amount: euros(2000) })]);
    });

    it('says nothing of the kind while the group is open', async () => {
        const group = groupOf([ana, bea], ana);
        open([group]);
        await screen.findByText(text.balance.allSettled);

        for (const notice of Object.values(text.group.closed)) expect(screen.queryByText(notice)).toBeNull();
    });
});

describe('a group out of reach', () => {
    it('opens from the copy on the device with the server out of reach', async () => {
        const group = groupOf([ana, bea], ana, { name: 'Lisbon' });
        const storage = createMemoryStorage();
        await leaveCopy(
            storage,
            [group],
            [
                expense(group, bea, [
                    [ana, 1000],
                    [bea, 1000],
                ]),
            ]
        );
        const api = createFakeApi();
        api.state.offline = true;
        stubApi(api.handler);
        onlineManager.setOnline(false);

        renderApp({ path: `/groups/${group.id}`, storage });

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
        expect(await screen.findByText(t('groups.balance.owe', { amount: euros(1000) }))).toBeDefined();
    });

    it('opens from an address that spells the id in capitals', async () => {
        const group = groupOf([ana, bea], ana, { name: 'Lisbon' });
        open([group], [], `/groups/${group.id.toUpperCase()}`);

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
        expect(screen.queryByText(text.group.missing)).toBeNull();
    });

    it('says so, with a way back to Groups, for a group the device does not hold', async () => {
        open([groupOf([ana, bea], ana)], [], `/groups/${crypto.randomUUID()}`);

        expect(await screen.findByText(text.group.missing)).toBeDefined();
        expect(screen.getByRole('link', { name: text.group.back }).getAttribute('href')).toBe('/groups');
        expect(screen.queryByRole('heading', { name: text.debts.label })).toBeNull();
    });

    it('says the groups could not be loaded when the device never had them and the server is out of reach', async () => {
        const api = createFakeApi();
        api.state.offline = true;
        stubApi(api.handler);
        onlineManager.setOnline(false);

        renderApp({ path: `/groups/${crypto.randomUUID()}` });

        expect(await screen.findByText(text.group.loadFailed)).toBeDefined();
        expect(screen.getByRole('link', { name: text.group.back }).getAttribute('href')).toBe('/groups');
    });

    it('says the expenses could not be loaded when the device never had them', async () => {
        const group = groupOf([ana, bea], ana, { name: 'Lisbon' });
        const api = createFakeApi({ groups: [group] });
        stubApi((url, init) =>
            url.pathname.endsWith('/entries') ? new Response(null, { status: 503 }) : api.handler(url, init)
        );

        renderApp({ path: `/groups/${group.id}` });

        expect(await screen.findByText(text.group.entriesFailed)).toBeDefined();
        expect(screen.getByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
        expect(screen.queryByText(text.balance.allSettled)).toBeNull();
    });
});

describe('in Spanish', () => {
    it('says the balance in Spanish', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const group = groupOf([ana, bea], ana);
        open(
            [group],
            [
                expense(group, ana, [
                    [ana, 2000],
                    [bea, 2000],
                ]),
            ]
        );

        const amount = formatAmount(2000, 'EUR', 'es').replace(/\s/g, ' ');
        const tEs = createTranslator({ locale: 'es', messages: es });
        expect(await screen.findByText(tEs('groups.balance.owed', { amount }))).toBeDefined();
        expect(screen.getByText(tEs('groups.debts.owesYou', { name: 'Bea', amount }))).toBeDefined();
    });
});
