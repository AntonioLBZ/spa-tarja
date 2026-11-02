import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { leaveCopy, person, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';
import { MAX_FRIENDS, MAX_GROUP_MEMBERS, MAX_OPEN_GROUPS } from '@core/shared-group';

import type { PendingEntry } from '@/lib/offline';
import type { Handler } from '@/lib/test/render-app';
import type { SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

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
        expect(
            within(screen.getByRole('main'))
                .getAllByRole('status')
                .map((notice) => notice.textContent)
        ).toEqual([
            t('groups.balance.owed', { amount: euros(2800) }),
            t('groups.balance.owe', { amount: euros(1250) }),
        ]);
    });

    it('say all is settled when nobody owes anything', async () => {
        open([sampleGroup()]);

        expect((await screen.findByText(text.balance.allSettled)).getAttribute('role')).toBe('status');
    });

    it('wait until every open group has its expenses on the device, and say why when one cannot be loaded', async () => {
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
        expect(await screen.findByText(text.totalsWait)).toBeDefined();
    });

    it('say nothing of the kind while every group has its expenses', async () => {
        open([sampleGroup()]);
        await screen.findByText(text.balance.allSettled);

        expect(screen.queryByText(text.totalsWait)).toBeNull();
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

    it('adds the person still in the field when it is made', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        fireEvent.click(newGroupToggle());

        addPerson('Cris');
        fireEvent.change(field(text.new.person), { target: { value: ' Dani ' } });
        makeGroup('Lisbon');

        await screen.findByRole('heading', { level: 1, name: 'Lisbon' });
        expect(api.groups[0]!.members.map((member) => member.name)).toEqual([TEST_USER.name, 'Cris', 'Dani']);
    });

    it('takes no more people than a group holds, and says so', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        fireEvent.click(newGroupToggle());
        const full = t('groups.new.full', { max: MAX_GROUP_MEMBERS });

        for (let index = 1; index < MAX_GROUP_MEMBERS; index++) {
            fireEvent.change(field(text.new.person), { target: { value: `Person ${index}` } });
            fireEvent.keyDown(field(text.new.person), { key: 'Enter' });
        }
        fireEvent.change(field(text.new.person), { target: { value: 'One more' } });
        fireEvent.keyDown(field(text.new.person), { key: 'Enter' });

        expect((await screen.findByRole('alert')).textContent).toBe(full);
        fireEvent.click(screen.getByRole('button', { name: text.new.add }));
        makeGroup('Lisbon');

        expect(screen.getByRole('alert').textContent).toBe(full);
        const added = within(screen.getByRole('list', { name: text.new.people })).getAllByRole('listitem');
        expect(added).toHaveLength(MAX_GROUP_MEMBERS - 1);
        expect(field(text.new.person).value).toBe('One more');
        expect(api.groupRequests).toEqual([]);
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

describe('making a group with friends', () => {
    function friendOf(
        name: string,
        overrides: Parameters<typeof person>[1] = {},
        closed: SharedGroup['closed'] = null
    ) {
        const me = person(TEST_USER.name, { role: 'owner' });
        return sampleGroup({ kind: 'direct', name: null, members: [me, person(name, overrides)], me: me.id, closed });
    }

    const friends = [
        friendOf('Bea'),
        friendOf('Cris', { claimed: false }),
        friendOf('Dani', {}, 'deleted'),
        friendOf('Eva'),
    ];

    function friendField() {
        return screen.getByRole('combobox', { name: text.new.friend });
    }

    function chooseFriend(name: string) {
        fireEvent.click(friendField());
        fireEvent.click(screen.getByRole('option', { name }));
        fireEvent.click(screen.getByRole('button', { name: text.new.addFriend }));
    }

    function listed() {
        return within(screen.getByRole('list', { name: text.new.people }))
            .getAllByRole('listitem')
            .map((item) => item.firstChild?.textContent);
    }

    function made(api: ReturnType<typeof createFakeApi>) {
        return api.groups.find((group) => group.kind === 'group')!;
    }

    async function start(wrap?: (handler: Handler) => Handler) {
        const api = createFakeApi({ groups: friends });
        stubApi(wrap ? wrap(api.handler) : api.handler);
        const app = renderApp({ path: '/groups' });
        await screen.findByText(text.balance.allSettled);
        fireEvent.click(newGroupToggle());
        return Object.assign(api, {
            sync: () => act(() => app.queryClient.invalidateQueries({ queryKey: GROUPS_KEY })),
        });
    }

    it('lists only the open friends who use the app, each added once', async () => {
        await start();

        fireEvent.click(friendField());
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
            text.new.friendNone,
            'Bea',
            'Eva',
        ]);
        fireEvent.click(screen.getByRole('option', { name: 'Bea' }));
        fireEvent.click(screen.getByRole('button', { name: text.new.addFriend }));

        expect(listed()).toEqual(['Bea']);
        expect(friendField().textContent).toBe(text.new.friendNone);
        fireEvent.click(friendField());
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([text.new.friendNone, 'Eva']);
    });

    it('chooses no friend again when the friend chosen is gone after a sync', async () => {
        const api = await start();
        fireEvent.click(friendField());
        fireEvent.click(screen.getByRole('option', { name: 'Bea' }));

        api.groups.find((group) => group.id === friends[0]!.id)!.closed = 'deleted';
        await api.sync();

        await waitFor(() => expect(friendField().textContent).toBe(text.new.friendNone));
        expect((screen.getByRole('button', { name: text.new.addFriend }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('adds each friend once the group is made with its dummies, and opens it', async () => {
        const api = await start();

        addPerson('Fran');
        chooseFriend('Eva');
        expect(listed()).toEqual(['Fran', 'Eva']);
        makeGroup('Lisbon');

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
        expect(made(api).members.map((member) => [member.name, member.claimed])).toEqual([
            [TEST_USER.name, true],
            ['Fran', false],
            ['Eva', true],
        ]);
        expect(api.groupRequests).toEqual([
            `PUT /api/groups/${made(api).id}`,
            `PUT /api/groups/${made(api).id}/members/${made(api).members[2]!.id}`,
        ]);
    });

    it('takes no friend past what a group holds', async () => {
        await start();

        for (let index = 1; index < MAX_GROUP_MEMBERS; index++) {
            fireEvent.change(field(text.new.person), { target: { value: `Person ${index}` } });
            fireEvent.keyDown(field(text.new.person), { key: 'Enter' });
        }
        chooseFriend('Bea');

        expect((await screen.findByRole('alert')).textContent).toBe(t('groups.new.full', { max: MAX_GROUP_MEMBERS }));
        expect(listed()).not.toContain('Bea');
    });

    it.each([
        ['already-member', text.failure.alreadyMember],
        ['unknown-friend', text.failure.unknownFriend],
        ['too-many-groups', t('groups.failure.friendTooManyGroups', { max: MAX_OPEN_GROUPS })],
    ])(
        'says why a friend could not be added (%s), and finishes the same group when sent again',
        async (error, words) => {
            let refuse = true;
            const api = await start((handler) => (url, init) => {
                if (refuse && url.pathname.includes('/members/')) return Response.json({ error }, { status: 409 });
                return handler(url, init);
            });
            chooseFriend('Bea');
            makeGroup('Lisbon');
            expect((await screen.findByRole('alert')).textContent).toBe(words);
            refuse = false;

            fireEvent.click(screen.getByRole('button', { name: text.new.submit }));

            await screen.findByRole('heading', { level: 1, name: 'Lisbon' });
            expect(api.groups.filter((group) => group.kind === 'group')).toHaveLength(1);
            expect(made(api).members.map((member) => member.name)).toEqual([TEST_USER.name, 'Bea']);
        }
    );

    it('ends with the people as they are listed when the answer of the first try was lost', async () => {
        let loseNext = true;
        const api = await start((handler) => async (url, init) => {
            const answer = await handler(url, init);
            if (init?.method === 'PUT' && loseNext) {
                loseNext = false;
                throw new TypeError('Failed to fetch');
            }
            return answer;
        });
        addPerson('Fran');
        addPerson('Gus');
        makeGroup('Lisbon');
        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.failed);

        fireEvent.click(screen.getByRole('button', { name: t('groups.new.removeItem', { name: 'Fran' }) }));
        addPerson('Hana');
        chooseFriend('Bea');
        makeGroup('Lisbon');

        await screen.findByRole('heading', { level: 1, name: 'Lisbon' });
        expect(api.groups.filter((group) => group.kind === 'group')).toHaveLength(1);
        expect(
            made(api)
                .members.filter((member) => member.leftAt === null)
                .map((member) => member.name)
        ).toEqual([TEST_USER.name, 'Gus', 'Hana', 'Bea']);
    });

    it('leaves the friends out when none of them uses the app', async () => {
        stubApi(createFakeApi({ groups: [friendOf('Cris', { claimed: false })] }).handler);
        renderApp({ path: '/groups' });
        await screen.findByText(text.balance.allSettled);
        fireEvent.click(newGroupToggle());

        expect(screen.queryByRole('combobox', { name: text.new.friend })).toBeNull();
    });

    it('turns the friends off without a connection', async () => {
        await start();

        onlineManager.setOnline(false);

        await screen.findByText(text.offline);
        expect((friendField() as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: text.new.addFriend }) as HTMLButtonElement).disabled).toBe(true);
    });
});

describe('adding a friend', () => {
    function friendToggle() {
        return screen.getByRole('button', { name: text.friend.title });
    }

    function addFriend(name: string) {
        fireEvent.change(field(text.friend.name), { target: { value: name } });
        fireEvent.click(screen.getByRole('button', { name: text.friend.submit }));
    }

    it('makes a friend with that name, who has not joined, and opens it', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        fireEvent.click(friendToggle());

        addFriend(' Cris ');

        expect(await screen.findByRole('heading', { level: 1, name: 'Cris' })).toBeDefined();
        expect(api.groups).toHaveLength(1);
        expect(api.groups[0]).toMatchObject({ kind: 'direct', name: null, currency: 'EUR' });
        expect(api.groups[0]!.members.map((member) => [member.name, member.role, member.claimed])).toEqual([
            [TEST_USER.name, 'owner', true],
            ['Cris', 'member', false],
        ]);
    });

    it('refuses a name with nothing that shows, without sending it', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        fireEvent.click(friendToggle());

        addFriend('​ ');

        expect((await screen.findByRole('alert')).textContent).toBe(text.nameInvalid);
        expect(field(text.friend.name).getAttribute('aria-invalid')).toBe('true');
        expect(api.groupRequests).toEqual([]);
    });

    it('says in words why the server refused it, and keeps what was typed', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        api.state.groupRefusal = { status: 409, error: 'too-many-friends' };
        fireEvent.click(friendToggle());

        addFriend('Cris');

        expect((await screen.findByRole('alert')).textContent).toBe(
            t('groups.failure.tooManyFriends', { max: MAX_FRIENDS })
        );
        expect(field(text.friend.name).value).toBe('Cris');
    });

    it('sends the same friend again after a failure, so a friend that was made is not made twice', async () => {
        const { api } = open();
        await screen.findByText(text.empty);
        api.state.groupRefusal = { status: 503 };
        fireEvent.click(friendToggle());
        addFriend('Cris');
        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.failed);
        api.state.groupRefusal = null;

        fireEvent.click(screen.getByRole('button', { name: text.friend.submit }));

        await screen.findByRole('heading', { level: 1, name: 'Cris' });
        const [first, second] = api.groupRequests;
        expect(second).toBe(first);
    });

    it('gives the friend the name typed last when the first answer was lost', async () => {
        const api = createFakeApi();
        let loseNext = true;
        const losing: Handler = async (url, init) => {
            const answer = await api.handler(url, init);
            if (init?.method === 'PUT' && loseNext) {
                loseNext = false;
                throw new TypeError('Failed to fetch');
            }
            return answer;
        };
        stubApi(losing);
        renderApp({ path: '/groups' });
        await screen.findByText(text.empty);
        fireEvent.click(friendToggle());
        addFriend('Cris');
        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.failed);

        addFriend('Cristina');

        expect(await screen.findByRole('heading', { level: 1, name: 'Cristina' })).toBeDefined();
        expect(api.groups).toHaveLength(1);
        expect(api.groups[0]!.members.map((member) => member.name)).toEqual([TEST_USER.name, 'Cristina']);
    });

    it('is off without a connection', async () => {
        open([sampleGroup({ name: 'Lisbon' })]);
        await screen.findByText(text.balance.allSettled);

        onlineManager.setOnline(false);

        await screen.findByText(text.offline);
        fireEvent.click(friendToggle());
        expect(field(text.friend.name).disabled).toBe(true);
        expect((screen.getByRole('button', { name: text.friend.submit }) as HTMLButtonElement).disabled).toBe(true);
    });
});
