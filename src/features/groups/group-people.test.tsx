import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { person, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';
import { MAX_GROUP_MEMBERS, MAX_OPEN_GROUPS, type GroupMember, type SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups.people;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');
const cris = person('Cris', { claimed: false });
const dani = person('Dani', { leftAt: 1 });

function trip(me: GroupMember = ana, overrides: Partial<SharedGroup> = {}) {
    return sampleGroup({ name: 'Lisbon', members: [ana, bea, cris, dani], me: me.id, ...overrides });
}

async function edit(group: SharedGroup) {
    const dinner = sampleEntry(group, {
        paidBy: ana.id,
        amountCents: 2000,
        shares: [
            { memberId: ana.id, cents: 1000 },
            { memberId: bea.id, cents: 1000 },
        ],
    });
    const api = createFakeApi({ groups: [group], entries: [dinner] });
    stubApi(api.handler);
    renderApp({ path: `/groups/${group.id}/edit` });
    await screen.findByRole('heading', { level: 2, name: text.title });
    await waitFor(() => expect(rows().join()).toContain(euros(1000)));
    const memberOf = (id: string) => api.groups[0]!.members.find((member) => member.id === id);
    return { api, memberOf };
}

function sheet() {
    return screen.getByRole('heading', { level: 2, name: text.title }).closest('section')!;
}

function rows() {
    return within(sheet())
        .getAllByRole('listitem')
        .map((row) => row.textContent);
}

function row(name: string) {
    return within(sheet()).getByRole('button', { name: new RegExp(`^${name}`) });
}

function button(name: string) {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function field(label: string) {
    return screen.getByLabelText(label) as HTMLInputElement;
}

afterEach(() => {
    localStorage.clear();
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the people of a group', () => {
    it('lists those who have not left, each with who they are and their balance in words', async () => {
        await edit(trip());

        expect(rows()).toEqual([
            `Ana${text.you}${text.owner}${t('groups.balance.owed', { amount: euros(1000) })}`,
            `Bea${t('groups.balance.memberOwes', { name: 'Bea', amount: euros(1000) })}`,
            `Cris${text.notJoined}${t('groups.balance.memberSettled', { name: 'Cris' })}`,
        ]);
    });

    it.each([
        ['a closed group', trip(ana, { closed: 'deleted' })],
        ['a friend', sampleGroup({ kind: 'direct', name: null })],
    ])('are not there for %s', async (_, group) => {
        stubApi(createFakeApi({ groups: [group] }).handler);
        renderApp({ path: `/groups/${group.id}/edit` });

        await screen.findByRole('checkbox', { name: en.groups.edit.show });
        expect(screen.queryByRole('heading', { name: text.title })).toBeNull();
        expect(screen.queryByLabelText(text.add)).toBeNull();
    });
    it('show no balance, and leave Remove to ask, while the expenses are not on the device', async () => {
        const group = trip();
        const api = createFakeApi({ groups: [group] });
        stubApi((url, init) =>
            url.pathname.endsWith('/entries') ? new Response(null, { status: 503 }) : api.handler(url, init)
        );
        renderApp({ path: `/groups/${group.id}/edit` });
        await screen.findByRole('heading', { level: 2, name: text.title });

        await waitFor(() => expect(rows()).toEqual([`Ana${text.you}${text.owner}`, 'Bea', `Cris${text.notJoined}`]));
        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.removeItem', { name: 'Bea' })));
        expect(screen.getByText(t('groups.people.removeConfirm', { name: 'Bea' }))).toBeDefined();
    });
});

describe('renaming', () => {
    it('lets the owner rename anybody', async () => {
        const { memberOf } = await edit(trip());

        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.renameItem', { name: 'Bea' })));
        expect(field(text.newName).value).toBe('Bea');
        expect(document.activeElement).toBe(field(text.newName));
        fireEvent.change(field(text.newName), { target: { value: ' Beatriz ' } });
        fireEvent.click(button(text.save));

        await waitFor(() => expect(memberOf(bea.id)?.name).toBe('Beatriz'));
        await waitFor(() => expect(rows()[1]).toMatch(/^Beatriz/));
        expect(screen.queryByLabelText(text.newName)).toBeNull();
    });

    it('goes back to the actions on Cancel, with nothing sent', async () => {
        const { api } = await edit(trip());

        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.renameItem', { name: 'Bea' })));
        fireEvent.click(button(text.cancel));

        expect(screen.queryByLabelText(text.newName)).toBeNull();
        expect(document.activeElement).toBe(button(t('groups.people.renameItem', { name: 'Bea' })));
        expect(api.groupRequests).toEqual([]);
    });

    it('refuses a name with nothing that shows, without sending it', async () => {
        const { api } = await edit(trip());

        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.renameItem', { name: 'Bea' })));
        fireEvent.change(field(text.newName), { target: { value: '   ' } });
        fireEvent.click(button(text.save));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.nameInvalid);
        expect(api.groupRequests).toEqual([]);
    });

    it('says the group is closed when it closed meanwhile', async () => {
        const { api } = await edit(trip());
        api.groups[0]!.closed = 'deleted';

        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.renameItem', { name: 'Bea' })));
        fireEvent.click(button(text.save));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.readOnly);
    });

    it('lets a member who is not the owner rename themselves only, and remove nobody', async () => {
        await edit(trip(bea));

        expect(within(sheet()).queryByRole('button', { name: /^Ana/ })).toBeNull();
        fireEvent.click(row('Bea'));
        expect(button(t('groups.people.renameItem', { name: 'Bea' }))).toBeDefined();
        expect(screen.queryByRole('button', { name: t('groups.people.removeItem', { name: 'Bea' }) })).toBeNull();
    });
});

describe('removing', () => {
    it('asks first, with the focus on Cancel, and takes the person out of the list', async () => {
        const { memberOf } = await edit(trip());

        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.removeItem', { name: 'Cris' })));

        expect(screen.getByText(t('groups.people.removeConfirm', { name: 'Cris' }))).toBeDefined();
        expect(document.activeElement).toBe(button(text.cancel));

        fireEvent.click(button(t('groups.people.removeItem', { name: 'Cris' })));

        await waitFor(() => expect(memberOf(cris.id)?.leftAt).not.toBeNull());
        await waitFor(() => expect(rows()).toHaveLength(2));
        await waitFor(() =>
            expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: text.title }))
        );
    });

    it('gives the focus back to Remove when the question is cancelled', async () => {
        const { api } = await edit(trip());

        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.removeItem', { name: 'Cris' })));
        fireEvent.click(button(text.cancel));

        expect(screen.queryByText(t('groups.people.removeConfirm', { name: 'Cris' }))).toBeNull();
        expect(document.activeElement).toBe(button(t('groups.people.removeItem', { name: 'Cris' })));
        expect(api.groupRequests).toEqual([]);
    });

    it('is not offered on the owner themselves', async () => {
        await edit(trip());

        fireEvent.click(row('Ana'));

        expect(button(t('groups.people.renameItem', { name: 'Ana' }))).toBeDefined();
        expect(screen.queryByRole('button', { name: t('groups.people.removeItem', { name: 'Ana' }) })).toBeNull();
    });

    it('says to settle up instead of asking when the balance is not zero', async () => {
        const { api } = await edit(trip());

        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.removeItem', { name: 'Bea' })));

        expect(screen.getByText(t('groups.people.unsettled', { name: 'Bea' }))).toBeDefined();
        expect(screen.queryByText(t('groups.people.removeConfirm', { name: 'Bea' }))).toBeNull();
        expect(screen.queryByRole('button', { name: t('groups.people.removeItem', { name: 'Bea' }) })).toBeNull();
        expect(api.groupRequests).toEqual([]);
    });

    it('says in words why the server refused it', async () => {
        const { api } = await edit(trip());
        api.state.groupRefusal = { status: 409, error: 'unsettled' };

        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.removeItem', { name: 'Cris' })));
        fireEvent.click(button(t('groups.people.removeItem', { name: 'Cris' })));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.unsettled);
        expect(rows()).toHaveLength(3);
    });
});

describe('adding a person', () => {
    it('adds a dummy by name, who shows as not joined', async () => {
        const { api } = await edit(trip());

        fireEvent.change(field(text.add), { target: { value: ' Eva ' } });
        fireEvent.click(button(text.addSubmit));

        await waitFor(() => expect(rows()).toHaveLength(4));
        expect(rows()[3]).toBe(`Eva${text.notJoined}${t('groups.balance.memberSettled', { name: 'Eva' })}`);
        expect(api.groups[0]!.members.at(-1)).toMatchObject({ name: 'Eva', claimed: false });
        expect(field(text.add).value).toBe('');
    });

    it('sends the same person again after a failure, so a dummy that landed is not added twice', async () => {
        const { api } = await edit(trip());
        api.state.groupRefusal = { status: 503 };
        fireEvent.change(field(text.add), { target: { value: 'Eva' } });
        fireEvent.click(button(text.addSubmit));
        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.failed);
        api.state.groupRefusal = null;

        fireEvent.click(button(text.addSubmit));

        await waitFor(() => expect(rows()).toHaveLength(4));
        const [first, second] = api.groupRequests;
        expect(second).toBe(first);
    });

    it('refuses a name with nothing that shows, without sending it', async () => {
        const { api } = await edit(trip());

        fireEvent.change(field(text.add), { target: { value: '​' } });
        fireEvent.click(button(text.addSubmit));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.nameInvalid);
        expect(api.groupRequests).toEqual([]);
    });

    it('says so when the group is full', async () => {
        const { api } = await edit(trip());
        api.state.groupRefusal = { status: 409, error: 'too-many-members' };

        fireEvent.change(field(text.add), { target: { value: 'Eva' } });
        fireEvent.click(button(text.addSubmit));

        expect((await screen.findByRole('alert')).textContent).toBe(
            t('groups.failure.tooManyMembers', { max: MAX_GROUP_MEMBERS })
        );
    });
});

describe('merging', () => {
    it('lets the owner merge a dummy into a member who uses the app, after saying it cannot be undone', async () => {
        const { memberOf } = await edit(trip());

        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.mergeItem', { name: 'Cris' })));

        expect(screen.getByText(t('groups.people.mergeQuestion', { name: 'Cris' }))).toBeDefined();
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: text.mergeInto }));
        fireEvent.click(screen.getByRole('combobox', { name: text.mergeInto }));
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([text.you, 'Bea']);
        fireEvent.click(screen.getByRole('option', { name: 'Bea' }));
        fireEvent.click(button(t('groups.people.mergeConfirmItem', { name: 'Cris' })));

        await waitFor(() => expect(memberOf(cris.id)?.mergedInto).toBe(bea.id));
        await waitFor(() => expect(rows()).toHaveLength(2));
        await waitFor(() =>
            expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: text.title }))
        );
    });

    it('goes back to the actions on Cancel, with the focus on Merge and nothing sent', async () => {
        const { api } = await edit(trip());

        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.mergeItem', { name: 'Cris' })));
        fireEvent.click(button(text.cancel));

        expect(screen.queryByText(t('groups.people.mergeQuestion', { name: 'Cris' }))).toBeNull();
        expect(document.activeElement).toBe(button(t('groups.people.mergeItem', { name: 'Cris' })));
        expect(api.groupRequests).toEqual([]);
    });

    it('is not offered on a member who uses the app', async () => {
        await edit(trip());

        fireEvent.click(row('Bea'));

        expect(screen.queryByRole('button', { name: t('groups.people.mergeItem', { name: 'Bea' }) })).toBeNull();
    });

    it('is not offered to a member who is not the owner, for whom a dummy has nothing to open', async () => {
        await edit(trip(bea));

        expect(within(sheet()).queryByRole('button', { name: /^Cris/ })).toBeNull();
    });

    it.each([
        ['not-placeholder', en.groups.failure.notPlaceholder],
        ['member-left', en.groups.failure.memberGone],
        ['not-a-user', en.groups.failure.notAUser],
    ])('says in words why the server refused it (%s)', async (error, words) => {
        const { api } = await edit(trip());
        api.state.groupRefusal = { status: 409, error };

        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.mergeItem', { name: 'Cris' })));
        fireEvent.click(button(t('groups.people.mergeConfirmItem', { name: 'Cris' })));

        expect((await screen.findByRole('alert')).textContent).toBe(words);
        expect(rows()).toHaveLength(3);
    });
});

describe('making someone owner', () => {
    it('asks with the focus on Cancel, then hands the group over and the row says so', async () => {
        const { api } = await edit(trip());

        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.makeOwnerItem', { name: 'Bea' })));

        expect(screen.getByText(t('groups.people.makeOwnerQuestion', { name: 'Bea' }))).toBeDefined();
        expect(document.activeElement).toBe(button(text.cancel));

        fireEvent.click(button(t('groups.people.makeOwnerItem', { name: 'Bea' })));

        await waitFor(() =>
            expect(api.groups[0]!.members.map((member) => member.role)).toEqual(['member', 'owner', 'member', 'member'])
        );
        await waitFor(() =>
            expect(rows()[1]).toBe(
                `Bea${text.owner}${t('groups.balance.memberOwes', { name: 'Bea', amount: euros(1000) })}`
            )
        );
        expect(rows()[0]).toBe(`Ana${text.you}${t('groups.balance.owed', { amount: euros(1000) })}`);
        expect(within(sheet()).queryByRole('button', { name: /^Bea/ })).toBeNull();
        await waitFor(() =>
            expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: text.title }))
        );
    });

    it('gives the focus back to Make owner when the question is cancelled', async () => {
        const { api } = await edit(trip());

        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.makeOwnerItem', { name: 'Bea' })));
        fireEvent.click(button(text.cancel));

        expect(document.activeElement).toBe(button(t('groups.people.makeOwnerItem', { name: 'Bea' })));
        expect(api.groupRequests).toEqual([]);
    });

    it('is not offered on a dummy nor on yourself', async () => {
        await edit(trip());

        fireEvent.click(row('Cris'));
        fireEvent.click(row('Ana'));

        expect(screen.queryByRole('button', { name: t('groups.people.makeOwnerItem', { name: 'Cris' }) })).toBeNull();
        expect(screen.queryByRole('button', { name: t('groups.people.makeOwnerItem', { name: 'Ana' }) })).toBeNull();
    });

    it('is not offered to a member who is not the owner', async () => {
        await edit(trip(bea));

        fireEvent.click(row('Bea'));

        expect(screen.queryByRole('button', { name: /^Make owner/ })).toBeNull();
    });

    it('says in words why the server refused it', async () => {
        const { api } = await edit(trip());
        api.state.groupRefusal = { status: 422, error: 'member-left' };

        fireEvent.click(row('Bea'));
        fireEvent.click(button(t('groups.people.makeOwnerItem', { name: 'Bea' })));
        fireEvent.click(button(t('groups.people.makeOwnerItem', { name: 'Bea' })));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.memberGone);
    });
});

describe('adding a friend', () => {
    function friendOf(name: string, claimed = true) {
        const me = person(TEST_USER.name, { role: 'owner' });
        return sampleGroup({ kind: 'direct', name: null, members: [me, person(name, { claimed })], me: me.id });
    }

    const eva = friendOf('Eva');

    async function editWith(group: SharedGroup, friends: SharedGroup[] = [eva, friendOf('Fran', false)]) {
        const api = createFakeApi({ groups: [group, ...friends] });
        stubApi(api.handler);
        renderApp({ path: `/groups/${group.id}/edit` });
        await screen.findByRole('heading', { level: 2, name: text.title });
        return { api, members: () => api.groups[0]!.members };
    }

    function choose(name: string) {
        fireEvent.click(screen.getByRole('combobox', { name: text.friend }));
        fireEvent.click(screen.getByRole('option', { name }));
    }

    it('lists the friends who use the app and adds one as a new member, who has joined', async () => {
        const { members } = await editWith(trip());

        fireEvent.click(screen.getByRole('combobox', { name: text.friend }));
        expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([text.friendNone, 'Eva']);
        fireEvent.click(screen.getByRole('option', { name: 'Eva' }));
        fireEvent.click(button(text.addFriend));

        await waitFor(() => expect(rows()).toHaveLength(4));
        expect(rows()[3]).toBe(`Eva${t('groups.balance.memberSettled', { name: 'Eva' })}`);
        expect(members().at(-1)).toMatchObject({ name: 'Eva', claimed: true });
        expect(members().find((member) => member.id === cris.id)?.mergedInto).toBeNull();
        expect(screen.getByRole('combobox', { name: text.friend }).textContent).toBe(text.friendNone);
    });

    it('lets the owner put the friend in place of a dummy, who leaves the list', async () => {
        const { members } = await editWith(trip());

        choose('Eva');
        const place = screen.getByRole('group', { name: text.place });
        expect(
            within(place)
                .getAllByRole('radio')
                .map((radio) => [radio.closest('label')!.textContent, (radio as HTMLInputElement).checked])
        ).toEqual([
            [text.asNew, true],
            [t('groups.people.inPlaceOf', { name: 'Cris' }), false],
        ]);
        fireEvent.click(within(place).getByLabelText(t('groups.people.inPlaceOf', { name: 'Cris' })));
        fireEvent.click(button(text.addFriend));

        await waitFor(() => expect(rows()).toHaveLength(3));
        expect(rows()[2]).toMatch(/^Eva/);
        const added = members().at(-1)!;
        expect(members().find((member) => member.id === cris.id)?.mergedInto).toBe(added.id);
    });

    it('asks nothing of a member who is not the owner', async () => {
        await editWith(trip(bea));

        choose('Eva');

        expect(screen.queryByRole('group', { name: text.place })).toBeNull();
    });

    it('asks nothing when the group has no dummies', async () => {
        await editWith(sampleGroup({ members: [ana, bea], me: ana.id }));

        choose('Eva');

        expect(screen.queryByRole('group', { name: text.place })).toBeNull();
    });

    it.each([
        ['already-member', en.groups.failure.alreadyMember],
        ['unknown-friend', en.groups.failure.unknownFriend],
        ['not-placeholder', en.groups.failure.notPlaceholder],
        ['too-many-groups', t('groups.failure.friendTooManyGroups', { max: MAX_OPEN_GROUPS })],
    ])('says in words why the server refused it (%s)', async (error, words) => {
        const { api } = await editWith(trip());
        api.state.groupRefusal = { status: 409, error };

        choose('Eva');
        fireEvent.click(button(text.addFriend));

        expect((await screen.findByRole('alert')).textContent).toBe(words);
        expect(rows()).toHaveLength(3);
    });

    it('is not there when no friend uses the app', async () => {
        await editWith(trip(), [friendOf('Fran', false)]);

        expect(screen.queryByRole('combobox', { name: text.friend })).toBeNull();
    });

    it('is off without a connection', async () => {
        await editWith(trip());
        choose('Eva');

        onlineManager.setOnline(false);

        await screen.findByText(en.groups.offline);
        expect((screen.getByRole('combobox', { name: text.friend }) as HTMLButtonElement).disabled).toBe(true);
        expect(button(text.addFriend).disabled).toBe(true);
    });
});

describe('without a connection', () => {
    it('turns adding and the actions of every person off', async () => {
        await edit(trip());

        onlineManager.setOnline(false);

        await screen.findByText(en.groups.offline);
        expect(field(text.add).disabled).toBe(true);
        expect(button(text.addSubmit).disabled).toBe(true);
        fireEvent.click(row('Bea'));
        expect(button(t('groups.people.renameItem', { name: 'Bea' })).disabled).toBe(true);
        expect(button(t('groups.people.makeOwnerItem', { name: 'Bea' })).disabled).toBe(true);
        expect(button(t('groups.people.removeItem', { name: 'Bea' })).disabled).toBe(true);
        fireEvent.click(row('Cris'));
        expect(button(t('groups.people.mergeItem', { name: 'Cris' })).disabled).toBe(true);
    });
});

describe('in Spanish', () => {
    it('names each action by words that hold what it shows', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const group = trip();
        stubApi(createFakeApi({ groups: [group] }).handler);
        renderApp({ path: `/groups/${group.id}/edit` });
        const people = (await screen.findByRole('heading', { level: 2, name: es.groups.people.title })).closest(
            'section'
        )!;

        fireEvent.click(within(people).getByRole('button', { name: /^Bea/ }));
        fireEvent.click(within(people).getByRole('button', { name: /^Cris/ }));

        const actions = within(people)
            .getAllByRole('button')
            .filter((action) => action.hasAttribute('aria-label'));
        expect(actions).toHaveLength(6);
        for (const action of actions) {
            expect(action.getAttribute('aria-label')!.toLowerCase()).toContain(action.textContent!.toLowerCase());
        }
    });
});
