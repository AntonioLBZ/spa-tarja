import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { leaveCopy, person, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { spokenText } from '@/lib/test/spoken-text';
import { INVITATION_DAYS } from '@core/invitation';
import { formatAmount } from '@core/money';
import { MAX_CLOSED_GROUPS, MAX_GROUP_MEMBERS, MAX_OPEN_GROUPS } from '@core/shared-group';

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
        .filter((row) => row.getAttribute('href') !== '/groups/new')
        .map((row) => spokenText(row));
}

function field(label: string) {
    return screen.getByLabelText(label) as HTMLInputElement;
}

function startNew(groups: SharedGroup[] = [], wrap?: (handler: Handler) => Handler) {
    const api = createFakeApi({ groups });
    stubApi(wrap ? wrap(api.handler) : api.handler);
    const app = renderApp({ path: '/groups/new' });
    return { api, app };
}

async function ready() {
    return screen.findByRole('heading', { level: 1, name: text.new.title });
}

function openSearch() {
    fireEvent.click(screen.getByRole('button', { name: text.new.addPeople }));
}

function search(query: string) {
    fireEvent.change(field(text.search.field), { target: { value: query } });
}

function byName(name: string) {
    return screen.getByText(t('groups.search.byName', { name })).closest('button')!;
}

function addPerson(name: string) {
    search(name);
    fireEvent.click(byName(name.trim()));
}

function closeSearch() {
    fireEvent.click(screen.getByRole('button', { name: text.search.close }));
}

function listed() {
    return within(screen.getByRole('list', { name: text.new.people }))
        .getAllByRole('listitem')
        .map((item) => item.firstChild?.textContent);
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
            await screen.findByText(t('groups.balance.owed', { amount: euros(2800) }), {
                selector: '.notice > .visually-hidden',
            })
        ).toBeDefined();
        expect(
            screen.getByText(t('groups.balance.owe', { amount: euros(1250) }), {
                selector: '.notice > .visually-hidden',
            })
        ).toBeDefined();
        expect(screen.queryByText(text.balance.allSettled)).toBeNull();
        expect(
            within(screen.getByRole('main'))
                .getAllByRole('status')
                .map((notice) => spokenText(notice))
        ).toEqual([
            t('groups.balance.owed', { amount: euros(2800) }),
            t('groups.balance.owe', { amount: euros(1250) }),
        ]);
        expect(
            within(screen.getByRole('main'))
                .getAllByRole('status')
                .map((notice) => notice.querySelector('.amount')?.className)
        ).toEqual(['amount amount--in', 'amount amount--out']);
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
            screen.queryByText(t('groups.balance.owed', { amount: euros(900) }), {
                selector: '.notice > .visually-hidden',
            })
        ).toBeNull();
        expect(screen.queryByText(text.balance.allSettled)).toBeNull();
        expect((await screen.findByText(text.totalsWait)).getAttribute('role')).toBe('status');
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
            await screen.findByText(t('groups.balance.owed', { amount: euros(500) }), {
                selector: '.notice > .visually-hidden',
            })
        ).toBeDefined();
        expect(screen.queryByText(t('groups.balance.owe', { amount: euros(0) }))).toBeNull();
        expect(screen.queryByText(text.balance.allSettled)).toBeNull();
    });
});

describe('the sections', () => {
    function section(label: string) {
        return screen.getByRole('heading', { level: 2, name: label }).closest('section')!;
    }

    function before(first: Element, second: Element) {
        return Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
    }

    it('are Groups and Friends, each under its heading, even with nothing in them', async () => {
        open();
        await screen.findByText(text.empty);

        const groups = section(text.lists.groups);
        const friends = section(text.lists.friends);
        expect(before(groups, friends)).toBe(true);
        expect(rows(text.lists.groups)).toEqual([]);
        expect(within(friends).queryAllByRole('link')).toEqual([]);
    });

    it('end the row of each heading with its action, New under Groups and Invite under Friends', async () => {
        open([sampleGroup({ name: 'Lisbon' })]);
        await screen.findByText(text.balance.allSettled);

        const groups = section(text.lists.groups);
        const friends = section(text.lists.friends);
        const make = within(groups).getByRole('link', { name: text.new.title });
        expect(make.textContent).toBe(text.lists.new);
        expect(make.getAttribute('href')).toBe('/groups/new');
        expect(within(groups).queryByRole('button', { name: text.links.make })).toBeNull();
        const invite = within(friends).getByRole('button', { name: text.links.make });
        expect(invite.textContent).toBe(text.links.makeShort);
        expect(within(friends).getByText(t('groups.links.hint', { days: INVITATION_DAYS }))).toBeDefined();
        expect(within(friends).queryByRole('link', { name: text.new.title })).toBeNull();
        for (const [label, action] of [
            [text.lists.groups, make],
            [text.lists.friends, invite],
        ] as const) {
            expect(screen.getByRole('heading', { level: 2, name: label }).parentElement).toBe(action.parentElement);
        }
    });

    it('put the heading and its action first, then the list', async () => {
        const friend = sampleGroup({ kind: 'direct', name: null });
        open([sampleGroup({ name: 'Lisbon' }), friend]);
        await screen.findByText(text.balance.allSettled);

        const order = (label: string, action: HTMLElement) => {
            const container = section(label);
            const heading = within(container).getByRole('heading', { level: 2, name: label });
            const row = within(container)
                .getAllByRole('link')
                .find((link) => link !== action)!;
            return before(heading, action) && before(action, row);
        };
        expect(order(text.lists.groups, screen.getByRole('link', { name: text.new.title }))).toBe(true);
        expect(order(text.lists.friends, screen.getByRole('button', { name: text.links.make }))).toBe(true);
    });

    it('leave that line out when the notice of an empty tab already says there is nothing', async () => {
        open();
        await screen.findByText(text.empty);
        expect(screen.queryByText(text.lists.friendsNone)).toBeNull();
    });

    it('say a friend appears when somebody accepts the link, until there is one', async () => {
        open([sampleGroup({ name: 'Lisbon' })]);
        await screen.findByText(text.balance.allSettled);
        expect(screen.getByText(text.lists.friendsNone)).toBeDefined();
    });

    it('leave that line out once there is a friend', async () => {
        open([sampleGroup({ kind: 'direct', name: null })]);
        await screen.findByText(text.balance.allSettled);

        expect(screen.queryByText(text.lists.friendsNone)).toBeNull();
    });

    it('keep the closed and the archived disclosures at the end', async () => {
        open([sampleGroup({ name: 'Rome', closed: 'deleted' })]);
        await screen.findByText(text.empty);

        const closed = screen.getByRole('button', { name: text.lists.closed });
        expect(before(section(text.lists.friends), closed)).toBe(true);
    });

    it('show the controls even when the groups cannot be loaded, without saying there are no friends', async () => {
        const api = createFakeApi();
        api.state.offline = true;
        stubApi(api.handler);
        renderApp({ path: '/groups' });

        expect((await screen.findByText(text.group.loadFailed)).getAttribute('role')).toBe('status');
        expect(within(section(text.lists.groups)).getByRole('link', { name: text.new.title })).toBeDefined();
        expect(within(section(text.lists.friends)).getByRole('button', { name: text.links.make })).toBeDefined();
        expect(screen.queryByText(text.lists.friendsNone)).toBeNull();
    });
});

describe('the lists', () => {
    it('put the groups and the friends in their own sections, each with your balance in words', async () => {
        const lisbon = sampleGroup({ name: 'Lisbon' });
        const porto = sampleGroup({ name: 'Porto' });
        const friend = sampleGroup({ kind: 'direct', name: null });
        open([lisbon, porto, friend], [owedByMe(lisbon, 1250), owedToMe(friend, 800)]);
        await screen.findByText(t('groups.balance.owe', { amount: euros(1250) }), {
            selector: '.notice > .visually-hidden',
        });

        expect(rows(text.lists.groups)).toEqual([
            `Lisbon${t('groups.balance.owe', { amount: euros(1250) })}`,
            `Porto${text.row.settled}`,
        ]);
        expect(rows(text.lists.friends)).toEqual([
            `Bea${t('groups.debts.owesYou', { name: 'Bea', amount: euros(800) })}`,
        ]);
    });

    it('read the links and the groups again each time the tab opens, also within the minute', async () => {
        const id = crypto.randomUUID();
        const api = createFakeApi({
            groups: [sampleGroup({ name: 'Lisbon' })],
            pending: [{ id, token: `${id}.${'A'.repeat(43)}`, expiresAt: Date.now() + 60_000 }],
        });
        stubApi(api.handler);
        renderApp({ path: '/groups' });
        await screen.findByRole('textbox', { name: text.invite.link });

        api.pendingInvitations.splice(0);
        api.groups.push(sampleGroup({ kind: 'direct', name: null }));
        fireEvent.click(screen.getAllByRole('link', { name: en.nav.expenses })[0]!);
        await screen.findByRole('button', { name: en.nav.add });
        fireEvent.click(screen.getAllByRole('link', { name: en.nav.groups })[0]!);

        await waitFor(() => expect(rows(text.lists.friends)).toHaveLength(1));
        expect(screen.queryByRole('textbox', { name: text.invite.link })).toBeNull();
    });

    it('lead each row to its group', async () => {
        const lisbon = sampleGroup({ name: 'Lisbon' });
        open([lisbon]);
        await screen.findByText(text.balance.allSettled);

        const row = within(sheet(text.lists.groups)).getByRole('link', { name: /^Lisbon/ });
        expect(row.getAttribute('href')).toBe(`/groups/${lisbon.id}`);

        fireEvent.click(row);

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
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
            await screen.findByText(t('groups.balance.owed', { amount: euros(700) }), {
                selector: '.notice > .visually-hidden',
            })
        ).toBeDefined();
        expect(rows(text.lists.groups)).toEqual([`Lisbon${t('groups.balance.owed', { amount: euros(700) })}`]);
    });
});

describe('making a group', () => {
    it('opens its own screen from New', async () => {
        open([sampleGroup({ name: 'Lisbon' })]);
        await screen.findByText(text.balance.allSettled);

        fireEvent.click(screen.getByRole('link', { name: text.new.title }));

        expect(await ready()).toBeDefined();
    });

    it('makes it with the people added by name in the search, and opens it', async () => {
        const { api } = startNew();
        await ready();
        openSearch();

        addPerson('Cris');
        expect(field(text.search.field).value).toBe('');
        expect(document.activeElement).toBe(field(text.search.field));
        expect(screen.getByText(t('groups.search.added', { name: 'Cris' })).getAttribute('role')).toBe('status');
        addPerson(' Dani ');
        addPerson('Eva');
        closeSearch();
        fireEvent.click(screen.getByRole('button', { name: t('groups.new.removeItem', { name: 'Cris' }) }));
        expect(listed()).toEqual(['Dani', 'Eva']);
        makeGroup(' Lisbon ');

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
        expect(api.groups).toHaveLength(1);
        expect(api.groups[0]).toMatchObject({ kind: 'group', name: 'Lisbon', currency: 'EUR' });
        expect(api.groups[0]!.members.map((member) => [member.name, member.role, member.claimed])).toEqual([
            ['Ana', 'owner', true],
            ['Dani', 'member', false],
            ['Eva', 'member', false],
        ]);
    });

    it('offers no one by name until what is typed is a name a group takes, and Enter adds nobody', async () => {
        startNew();
        await ready();
        openSearch();

        expect(screen.getByText(text.search.empty)).toBeDefined();
        search('​  ');
        expect(screen.queryByText(t('groups.search.byName', { name: '​' }))).toBeNull();
        search('Cris');
        fireEvent.keyDown(field(text.search.field), { key: 'Enter' });
        closeSearch();

        expect(screen.queryByRole('list', { name: text.new.people })).toBeNull();
    });

    it('takes no more people than a group holds, and says so', async () => {
        const { api } = startNew();
        await ready();
        openSearch();

        for (let index = 1; index < MAX_GROUP_MEMBERS; index++) addPerson(`Person ${index}`);
        search('One more');

        expect(screen.getByRole('alert').textContent).toBe(t('groups.new.full', { max: MAX_GROUP_MEMBERS }));
        expect(byName('One more').disabled).toBe(true);
        closeSearch();
        expect(listed()).toHaveLength(MAX_GROUP_MEMBERS - 1);
        expect(api.groupRequests).toEqual([]);
    });

    it('refuses a name with nothing that shows, without sending it', async () => {
        const { api } = startNew();
        await ready();

        makeGroup('​  ');

        expect((await screen.findByRole('alert')).textContent).toBe(text.nameInvalid);
        expect(field(text.new.name).getAttribute('aria-invalid')).toBe('true');
        expect(api.groupRequests).toEqual([]);
    });

    it('says in words that the closed groups are the most there can be, and keeps what was typed', async () => {
        const { api } = startNew();
        await ready();
        api.state.groupRefusal = { status: 409, error: 'too-many-closed-groups' };

        makeGroup('Lisbon');

        expect((await screen.findByRole('alert')).textContent).toBe(
            t('groups.failure.tooManyClosedGroups', { max: MAX_CLOSED_GROUPS })
        );
        expect(field(text.new.name).value).toBe('Lisbon');
    });

    it('says in words why the server refused it, and keeps what was typed', async () => {
        const { api } = startNew();
        await ready();
        api.state.groupRefusal = { status: 409, error: 'too-many-groups' };

        makeGroup('Lisbon');

        expect((await screen.findByRole('alert')).textContent).toBe(
            t('groups.failure.tooManyGroups', { max: MAX_OPEN_GROUPS })
        );
        expect(field(text.new.name).value).toBe('Lisbon');
    });

    it('sends the same group again after a failure, so a make that landed is not made twice', async () => {
        const { api } = startNew();
        await ready();
        api.state.groupRefusal = { status: 503 };
        makeGroup('Lisbon');
        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.failed);
        api.state.groupRefusal = null;

        fireEvent.click(screen.getByRole('button', { name: text.new.submit }));

        await screen.findByRole('heading', { level: 1, name: 'Lisbon' });
        const [first, second] = api.groupRequests;
        expect(first).toMatch(/^PUT \/api\/groups\//);
        expect(second).toBe(first);
    });

    it('is off without a connection, which a notice says', async () => {
        startNew();
        await ready();

        onlineManager.setOnline(false);

        expect(await screen.findByText(text.offline)).toBeDefined();
        expect(field(text.new.name).disabled).toBe(true);
        expect((screen.getByRole('button', { name: text.new.addPeople }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: text.new.submit }) as HTMLButtonElement).disabled).toBe(true);
    });
});

describe('making a group with friends', () => {
    function friendOf(
        name: string,
        overrides: Parameters<typeof person>[1] = {},
        closed: SharedGroup['closed'] = null
    ) {
        const me = person('Ana', { role: 'owner' });
        return sampleGroup({ kind: 'direct', name: null, members: [me, person(name, overrides)], me: me.id, closed });
    }

    const friends = [friendOf('Bea'), friendOf('Dani', {}, 'deleted'), friendOf('Agustín'), friendOf('Eva')];

    function offered() {
        return within(screen.getByRole('list', { name: text.search.results }))
            .queryAllByRole('button')
            .map((row) => row.textContent);
    }

    function chooseFriend(name: string) {
        fireEvent.click(screen.getByRole('button', { name }));
    }

    function made(api: ReturnType<typeof createFakeApi>) {
        return api.groups.find((group) => group.kind === 'group')!;
    }

    async function start(wrap?: (handler: Handler) => Handler) {
        const { api, app } = startNew(friends, wrap);
        await ready();
        openSearch();
        await waitFor(() => expect(offered().length).toBeGreaterThan(0));
        return Object.assign(api, {
            sync: () => act(() => app.queryClient.invalidateQueries({ queryKey: GROUPS_KEY })),
        });
    }

    it('lists every open friend while nothing is typed, and each friend once', async () => {
        await start();

        expect(offered()).toEqual(['Bea', 'Agustín', 'Eva']);
        chooseFriend('Bea');

        expect(offered()).toEqual(['Agustín', 'Eva']);
        closeSearch();
        expect(listed()).toEqual(['Bea']);
    });

    it('finds the friends whose name holds what is typed, ignoring case and accents, before adding by name', async () => {
        await start();

        search('agus');

        expect(offered()).toEqual(['Agustín', t('groups.search.byName', { name: 'agus' }) + text.search.byNameHint]);
        search('Zoe');
        expect(offered()).toEqual([t('groups.search.byName', { name: 'Zoe' }) + text.search.byNameHint]);
    });

    it('drops a friend who is gone after a sync', async () => {
        const api = await start();

        api.groups.find((group) => group.id === friends[0]!.id)!.closed = 'deleted';
        await api.sync();

        await waitFor(() => expect(offered()).toEqual(['Agustín', 'Eva']));
    });

    it('adds each friend once the group is made with its dummies, and opens it', async () => {
        const api = await start();

        addPerson('Fran');
        chooseFriend('Eva');
        closeSearch();
        expect(listed()).toEqual(['Fran', 'Eva']);
        makeGroup('Lisbon');

        expect(await screen.findByRole('heading', { level: 1, name: 'Lisbon' })).toBeDefined();
        expect(made(api).members.map((member) => [member.name, member.claimed])).toEqual([
            ['Ana', true],
            ['Fran', false],
            ['Eva', true],
        ]);
        expect(api.groupRequests).toEqual([
            `PUT /api/groups/${made(api).id}`,
            `PUT /api/groups/${made(api).id}/members/${made(api).members[2]!.id}`,
        ]);
    });

    it('marks a friend with a filled person and somebody added by name with one in outline', async () => {
        await start();

        addPerson('Fran');
        search('');
        chooseFriend('Eva');
        closeSearch();

        expect(
            within(screen.getByRole('list', { name: text.new.people }))
                .getAllByRole('listitem')
                .map((item) => [
                    item.textContent?.replace(text.new.remove, ''),
                    item.querySelector('svg')?.dataset.icon,
                ])
        ).toEqual([
            ['Fran', 'person'],
            ['Eva', 'person_filled'],
        ]);
    });

    it('takes no friend past what a group holds', async () => {
        await start();

        for (let index = 1; index < MAX_GROUP_MEMBERS; index++) addPerson(`Person ${index}`);
        search('');

        expect(screen.getByRole('alert').textContent).toBe(t('groups.new.full', { max: MAX_GROUP_MEMBERS }));
        expect((screen.getByRole('button', { name: 'Bea' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it.each([
        ['already-member', text.failure.alreadyMember],
        ['unknown-friend', text.failure.unknownFriend],
        ['too-many-groups', t('groups.failure.friendTooManyGroups', { max: MAX_OPEN_GROUPS })],
        ['too-many-closed-groups', t('groups.failure.friendTooManyClosedGroups', { max: MAX_CLOSED_GROUPS })],
    ])(
        'says why a friend could not be added (%s), and finishes the same group when sent again',
        async (error, words) => {
            let refuse = true;
            const api = await start((handler) => (url, init) => {
                if (refuse && url.pathname.includes('/members/')) return Response.json({ error }, { status: 409 });
                return handler(url, init);
            });
            chooseFriend('Bea');
            closeSearch();
            makeGroup('Lisbon');
            expect((await screen.findByRole('alert')).textContent).toBe(words);
            refuse = false;

            fireEvent.click(screen.getByRole('button', { name: text.new.submit }));

            await screen.findByRole('heading', { level: 1, name: 'Lisbon' });
            expect(api.groups.filter((group) => group.kind === 'group')).toHaveLength(1);
            expect(made(api).members.map((member) => member.name)).toEqual(['Ana', 'Bea']);
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
        closeSearch();
        makeGroup('Lisbon');
        expect((await screen.findByRole('alert')).textContent).toBe(text.failure.failed);

        fireEvent.click(screen.getByRole('button', { name: t('groups.new.removeItem', { name: 'Fran' }) }));
        openSearch();
        addPerson('Hana');
        search('');
        chooseFriend('Bea');
        closeSearch();
        makeGroup('Lisbon');

        await screen.findByRole('heading', { level: 1, name: 'Lisbon' });
        expect(api.groups.filter((group) => group.kind === 'group')).toHaveLength(1);
        expect(
            made(api)
                .members.filter((member) => member.leftAt === null)
                .map((member) => member.name)
        ).toEqual(['Ana', 'Gus', 'Hana', 'Bea']);
    });

    it('turns the rows off without a connection', async () => {
        await start();

        onlineManager.setOnline(false);

        await waitFor(() =>
            expect((screen.getByRole('button', { name: 'Bea' }) as HTMLButtonElement).disabled).toBe(true)
        );
    });
});

describe('making a friend', () => {
    it.each([
        ['with groups', [sampleGroup({ name: 'Lisbon' })], text.balance.allSettled],
        ['with nothing in them', [], text.empty],
    ])('has no control to add one by name, %s', async (_, groups, ready) => {
        open(groups);
        await screen.findByText(ready);

        expect(screen.queryByRole('button', { name: /by name/i })).toBeNull();
        expect(screen.queryByLabelText(/their name/i)).toBeNull();
        expect(screen.queryByRole('button', { name: /add the friend/i })).toBeNull();
    });
});
