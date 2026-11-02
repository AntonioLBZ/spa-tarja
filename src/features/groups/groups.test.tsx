import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { leaveCopy, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';
import { MAX_OPEN_GROUPS } from '@core/shared-group';

import type { PendingEntry } from '@/lib/offline';
import type { SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

// The test user paid it all and Bea owes her part, or the other way round
function owedToMe(group: SharedGroup, cents: number) {
    return sampleEntry(group, {
        amountCents: cents * 2,
        shares: group.members.map((member) => ({ memberId: member.id, cents })),
    });
}

function owedByMe(group: SharedGroup, cents: number) {
    return { ...owedToMe(group, cents), paidBy: group.members[1]!.id };
}

function open(groups: SharedGroup[] = [], entries: PendingEntry[] = []) {
    const api = createFakeApi({ groups, entries });
    stubApi(api.handler);
    return { api, app: renderApp({ path: '/groups' }) };
}

function sheet(label: string) {
    return screen.getByRole('heading', { level: 2, name: label }).closest('section')!;
}

function rows(label: string) {
    return within(sheet(label))
        .getAllByRole('link')
        .map((row) => row.textContent);
}

function newGroupToggle() {
    return screen.getByRole('button', { name: text.new.title });
}

function field(label: string) {
    return screen.getByLabelText(label) as HTMLInputElement;
}

function addPerson(name: string) {
    fireEvent.change(field(text.new.person), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: text.new.add }));
}

function makeGroup(name: string) {
    fireEvent.change(field(text.new.name), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: text.new.submit }));
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the totals', () => {
    it('add what you are owed and what you owe across open groups and friends', async () => {
        const lisbon = sampleGroup({ name: 'Lisbon' });
        const porto = sampleGroup({ name: 'Porto' });
        const friend = sampleGroup({ kind: 'direct', name: null });
        const closed = sampleGroup({ name: 'Old', closed: 'deleted' });
        open(
            [lisbon, porto, friend, closed],
            [owedToMe(lisbon, 2000), owedByMe(porto, 1250), owedToMe(friend, 800), owedToMe(closed, 5000)]
        );

        expect(
            await screen.findByText(t('groups.balance.owed', { amount: euros(2800) }), { selector: '.notice' })
        ).toBeDefined();
        expect(
            screen.getByText(t('groups.balance.owe', { amount: euros(1250) }), { selector: '.notice' })
        ).toBeDefined();
        expect(screen.queryByText(text.balance.allSettled)).toBeNull();
    });

    it('say all is settled when nobody owes anything', async () => {
        open([sampleGroup()]);

        expect(await screen.findByText(text.balance.allSettled)).toBeDefined();
    });

    it('say nothing until every open group has its expenses on the device', async () => {
        const lisbon = sampleGroup({ name: 'Lisbon' });
        const porto = sampleGroup({ name: 'Porto' });
        const api = createFakeApi({ groups: [lisbon, porto], entries: [owedToMe(lisbon, 900)] });
        stubApi((url, init) =>
            url.pathname === `/api/groups/${porto.id}/entries`
                ? new Response(null, { status: 503 })
                : api.handler(url, init)
        );
        renderApp({ path: '/groups' });

        await waitFor(() =>
            expect(rows(text.lists.groups)).toEqual([
                `Lisbon${t('groups.balance.owed', { amount: euros(900) })}`,
                'Porto',
            ])
        );
        expect(
            screen.queryByText(t('groups.balance.owed', { amount: euros(900) }), { selector: '.notice' })
        ).toBeNull();
        expect(screen.queryByText(text.balance.allSettled)).toBeNull();
    });

    it('leave out what is zero', async () => {
        const lisbon = sampleGroup();
        open([lisbon], [owedToMe(lisbon, 500)]);

        expect(
            await screen.findByText(t('groups.balance.owed', { amount: euros(500) }), { selector: '.notice' })
        ).toBeDefined();
        expect(screen.queryByText(t('groups.balance.owe', { amount: euros(0) }))).toBeNull();
        expect(screen.queryByText(text.balance.allSettled)).toBeNull();
    });
});

describe('the lists', () => {
    it('put the groups and the friends on their own sheets, each with your balance in words', async () => {
        const lisbon = sampleGroup({ name: 'Lisbon' });
        const porto = sampleGroup({ name: 'Porto' });
        const friend = sampleGroup({ kind: 'direct', name: null });
        open([lisbon, porto, friend], [owedByMe(lisbon, 1250), owedToMe(friend, 800)]);
        await screen.findByText(t('groups.balance.owe', { amount: euros(1250) }), { selector: '.notice' });

        expect(rows(text.lists.groups)).toEqual([
            `Lisbon${t('groups.balance.owe', { amount: euros(1250) })}`,
            `Porto${text.row.settled}`,
        ]);
        expect(rows(text.lists.friends)).toEqual([
            `Bea${t('groups.debts.owesYou', { name: 'Bea', amount: euros(800) })}`,
        ]);
    });

    it('lead each row to its group', async () => {
        const lisbon = sampleGroup({ name: 'Lisbon' });
        open([lisbon]);
        await screen.findByText(text.balance.allSettled);

        const row = within(sheet(text.lists.groups)).getByRole('link');
        expect(row.getAttribute('href')).toBe(`/groups/${lisbon.id}`);

        fireEvent.click(row);

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
    });

    it('leave out a sheet with nothing on it', async () => {
        open([sampleGroup({ name: 'Lisbon' })]);
        await screen.findByText(text.balance.allSettled);

        expect(screen.queryByRole('heading', { level: 2, name: text.lists.friends })).toBeNull();
    });

    it('keep the closed and the archived ones apart, under disclosures closed at first', async () => {
        const open1 = sampleGroup({ name: 'Lisbon' });
        const deleted = sampleGroup({ name: 'Rome', closed: 'deleted' });
        const left = sampleGroup({ name: 'Paris', closed: 'left', showInExpenses: false });
        const friend = sampleGroup({ kind: 'direct', name: null, closed: 'deleted' });
        const archived = sampleGroup({ name: 'Oslo', closed: 'deleted', archived: true });
        open([open1, deleted, left, friend, archived]);
        await screen.findByText(text.balance.allSettled);

        await waitFor(() => expect(rows(text.lists.groups)).toEqual([`Lisbon${text.row.settled}`]));
        const closedToggle = screen.getByRole('button', { name: text.lists.closed });
        const archivedToggle = screen.getByRole('button', { name: text.lists.archived });
        expect(closedToggle.getAttribute('aria-expanded')).toBe('false');
        expect(archivedToggle.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(closedToggle);
        fireEvent.click(archivedToggle);

        const closedRows = within(closedToggle.closest('.disclosure')!)
            .getAllByRole('link')
            .map((row) => row.textContent);
        expect(closedRows).toEqual([
            `Rome${text.row.deleted}${text.row.shown}`,
            `Paris${text.row.left}${text.row.hidden}`,
            `Bea${text.row.deletedFriend}${text.row.shown}`,
        ]);
        const archivedRows = within(archivedToggle.closest('.disclosure')!)
            .getAllByRole('link')
            .map((row) => row.textContent);
        expect(archivedRows).toEqual([`Oslo${text.row.deleted}${text.row.shown}`]);
    });

    it('leave out the closed and the archived disclosures when there is nothing in them', async () => {
        open([sampleGroup()]);
        await screen.findByText(text.balance.allSettled);

        expect(screen.queryByRole('button', { name: text.lists.closed })).toBeNull();
        expect(screen.queryByRole('button', { name: text.lists.archived })).toBeNull();
    });

    it('say so when there is no group or friend yet, with no totals', async () => {
        open([sampleGroup({ closed: 'deleted' })]);

        expect(await screen.findByText(text.empty)).toBeDefined();
        expect(screen.queryByText(text.balance.allSettled)).toBeNull();
        expect(screen.getByRole('button', { name: text.lists.closed })).toBeDefined();
    });

    it('open from the copy on the device with the server out of reach', async () => {
        const lisbon = sampleGroup({ name: 'Lisbon' });
        const storage = createMemoryStorage();
        await leaveCopy(storage, [lisbon], [owedToMe(lisbon, 700)]);
        const api = createFakeApi();
        api.state.offline = true;
        stubApi(api.handler);
        onlineManager.setOnline(false);

        renderApp({ path: '/groups', storage });

        expect(
            await screen.findByText(t('groups.balance.owed', { amount: euros(700) }), { selector: '.notice' })
        ).toBeDefined();
        expect(rows(text.lists.groups)).toEqual([`Lisbon${t('groups.balance.owed', { amount: euros(700) })}`]);
    });
});

describe('making a group', () => {
    it('makes it with the people added by name, one at a time, and opens it', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        fireEvent.click(newGroupToggle());

        addPerson('Cris');
        fireEvent.change(field(text.new.person), { target: { value: ' Dani ' } });
        fireEvent.keyDown(field(text.new.person), { key: 'Enter' });
        addPerson('Eva');
        fireEvent.click(screen.getByRole('button', { name: t('groups.new.removeItem', { name: 'Cris' }) }));
        expect(
            within(screen.getByRole('list', { name: text.new.people }))
                .getAllByRole('listitem')
                .map((item) => item.firstChild?.textContent)
        ).toEqual(['Dani', 'Eva']);
        expect(field(text.new.person).value).toBe('');
        makeGroup(' Lisbon ');

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
        expect(api.groups).toHaveLength(1);
        expect(api.groups[0]).toMatchObject({ kind: 'group', name: 'Lisbon', currency: 'EUR' });
        expect(api.groups[0]!.members.map((member) => [member.name, member.role, member.claimed])).toEqual([
            [TEST_USER.name, 'owner', true],
            ['Dani', 'member', false],
            ['Eva', 'member', false],
        ]);
    });

    it('refuses a name with nothing that shows, without sending it', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        fireEvent.click(newGroupToggle());

        makeGroup('​  ');

        expect((await screen.findByRole('alert')).textContent).toBe(text.nameInvalid);
        expect(field(text.new.name).getAttribute('aria-invalid')).toBe('true');
        expect(api.groupRequests).toEqual([]);
    });

    it('refuses a person with nothing that shows, and keeps the field as it was', async () => {
        open();
        await screen.findByText(text.empty);
        fireEvent.click(newGroupToggle());

        addPerson('   ');

        expect((await screen.findByRole('alert')).textContent).toBe(text.nameInvalid);
        expect(screen.queryByRole('list', { name: text.new.people })).toBeNull();
    });

    it('says in words why the server refused it, and keeps what was typed', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        api.state.groupRefusal = { status: 409, error: 'too-many-groups' };
        fireEvent.click(newGroupToggle());

        makeGroup('Lisbon');

        expect((await screen.findByRole('alert')).textContent).toBe(
            t('groups.failure.tooManyGroups', { max: MAX_OPEN_GROUPS })
        );
        expect(field(text.new.name).value).toBe('Lisbon');
    });

    it('sends the same group again after a failure, so a make that landed is not made twice', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        api.state.groupRefusal = { status: 503 };
        fireEvent.click(newGroupToggle());
        makeGroup('Lisbon');
        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.failed);
        api.state.groupRefusal = null;

        fireEvent.click(screen.getByRole('button', { name: text.new.submit }));

        await screen.findByRole('heading', { level: 1, name: 'Lisbon' });
        const [first, second] = api.groupRequests;
        expect(first).toMatch(/^PUT \/api\/groups\//);
        expect(second).toBe(first);
    });

    it('is off without a connection, which a notice says, while the lists stay', async () => {
        open([sampleGroup({ name: 'Lisbon' })]);
        await screen.findByText(text.balance.allSettled);

        onlineManager.setOnline(false);

        expect(await screen.findByText(text.offline)).toBeDefined();
        fireEvent.click(newGroupToggle());
        expect(field(text.new.name).disabled).toBe(true);
        expect(field(text.new.person).disabled).toBe(true);
        expect((screen.getByRole('button', { name: text.new.submit }) as HTMLButtonElement).disabled).toBe(true);
        expect(rows(text.lists.groups)).toEqual([`Lisbon${text.row.settled}`]);
    });
});
