import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/testing/fake-api';
import { TEST_USER } from '@/lib/testing/fake-auth';
import { person, sampleEntry, sampleGroup } from '@/lib/testing/groups';
import { renderApp, stubApi } from '@/lib/testing/render-app';
import { chosenOption, optionNames, pickOption } from '@/lib/testing/select';
import { formatAmount } from '@core/basics/money';
import {
    MAX_CLOSED_GROUPS,
    MAX_GROUP_MEMBERS,
    MAX_OPEN_GROUPS,
    type GroupMember,
    type SharedGroup,
} from '@core/groups/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups.people;
const you = t('groups.names.you', { name: 'Ana' });

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
    const app = renderApp({ path: `/groups/${group.id}/edit` });
    await screen.findByRole('heading', { level: 2, name: text.title });
    await waitFor(() => expect(rows().join()).toContain(euros(1000)));
    const memberOf = (id: string) => api.groups[0]!.members.find((member) => member.id === id);
    const sync = () => act(() => app.queryClient.invalidateQueries({ queryKey: GROUPS_KEY }));
    return { api, memberOf, sync };
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

function openSearch() {
    fireEvent.click(button(text.add));
}

function search(query: string) {
    fireEvent.change(field(en.groups.search.field), { target: { value: query } });
}

function byName(name: string) {
    return screen.getByText(t('groups.search.byName', { name })).closest('button')!;
}

function addByName(name: string) {
    openSearch();
    search(name);
    fireEvent.click(byName(name.trim()));
}

function offered() {
    return within(screen.getByRole('list', { name: en.groups.search.results }))
        .queryAllByRole('button')
        .map((item) => item.textContent);
}

function descriptionOf(control: HTMLElement) {
    return control
        .getAttribute('aria-describedby')
        ?.split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join(' ');
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
    it('mark who uses the app with a filled person and a dummy with one in outline', async () => {
        await edit(trip());

        expect(
            within(sheet())
                .getAllByRole('listitem')
                .map((item) => item.querySelector('svg[data-icon^="person"]')?.getAttribute('data-icon'))
        ).toEqual(['person_filled', 'person_filled', 'person']);
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
        expect(descriptionOf(button(text.cancel))).toBe(t('groups.people.removeConfirm', { name: 'Cris' }));

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
        expect(descriptionOf(button(text.cancel))).toBe(t('groups.people.unsettled', { name: 'Bea' }));
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
    it('adds a dummy by name from the search, who shows as not joined, and stays in the search', async () => {
        const { api } = await edit(trip());

        addByName(' Eva ');

        await waitFor(() => expect(rows()).toHaveLength(4));
        expect(rows()[3]).toBe(`Eva${text.notJoined}${t('groups.balance.memberSettled', { name: 'Eva' })}`);
        expect(api.groups[0]!.members.at(-1)).toMatchObject({ name: 'Eva', claimed: false });
        await waitFor(() => expect(field(en.groups.search.field).value).toBe(''));
        expect(screen.getByText(t('groups.search.added', { name: 'Eva' }))).toBeDefined();
        expect(document.activeElement).toBe(field(en.groups.search.field));
    });

    it('sends the same person again after a failure, so a dummy that landed is not added twice', async () => {
        const { api } = await edit(trip());
        api.state.groupRefusal = { status: 503 };
        addByName('Eva');
        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.failed);
        api.state.groupRefusal = null;

        fireEvent.click(byName('Eva'));

        await waitFor(() => expect(rows()).toHaveLength(4));
        const [first, second] = api.groupRequests;
        expect(second).toBe(first);
    });

    it('offers nobody by name for a name with nothing that shows', async () => {
        await edit(trip());

        openSearch();
        search('​');

        expect(screen.queryByText(t('groups.search.byName', { name: '​' }))).toBeNull();
    });

    it('says so when the group is full', async () => {
        const { api } = await edit(trip());
        api.state.groupRefusal = { status: 409, error: 'too-many-members' };

        addByName('Eva');

        expect((await screen.findByRole('alert')).textContent).toBe(
            t('groups.failure.tooManyMembers', { max: MAX_GROUP_MEMBERS })
        );
    });

    it('gives the focus back to Add a person once the search is closed', async () => {
        await edit(trip());

        openSearch();
        fireEvent.click(button(en.groups.search.close));

        expect(document.activeElement).toBe(button(text.add));
    });
});

describe('merging', () => {
    it('lets the owner merge a dummy into a member who uses the app, after saying it cannot be undone', async () => {
        const { memberOf } = await edit(trip());

        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.mergeItem', { name: 'Cris' })));

        expect(screen.getByText(t('groups.people.mergeQuestion', { name: 'Cris' }))).toBeDefined();
        expect(descriptionOf(button(text.cancel))).toBe(t('groups.people.mergeQuestion', { name: 'Cris' }));
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: text.mergeInto }));
        expect(chosenOption(text.mergeInto)).toBe(text.mergeNone);
        expect(button(t('groups.people.mergeConfirmItem', { name: 'Cris' })).disabled).toBe(true);
        expect(optionNames(text.mergeInto)).toEqual([text.mergeNone, you, 'Bea']);
        expect(screen.getByText(t('groups.people.mergeMissing', { name: 'Cris' }))).toBeDefined();
        pickOption(text.mergeInto, 'Bea');
        fireEvent.click(button(t('groups.people.mergeConfirmItem', { name: 'Cris' })));

        await waitFor(() => expect(memberOf(cris.id)?.mergedInto).toBe(bea.id));
        await waitFor(() => expect(rows()).toHaveLength(2));
        await waitFor(() =>
            expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: text.title }))
        );
    });

    it('offers no member who deleted their account', async () => {
        await edit(trip(ana, { members: [ana, bea, cris, person('')] }));

        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.mergeItem', { name: 'Cris' })));
        expect(optionNames(text.mergeInto)).toEqual([text.mergeNone, you, 'Bea']);
    });

    it('chooses nobody again when the one chosen leaves while the panel is open', async () => {
        const { api, sync } = await edit(trip());
        fireEvent.click(row('Cris'));
        fireEvent.click(button(t('groups.people.mergeItem', { name: 'Cris' })));
        pickOption(text.mergeInto, 'Bea');

        api.groups[0]!.members.find((member) => member.id === bea.id)!.leftAt = 2;
        await sync();

        await waitFor(() => expect(chosenOption(text.mergeInto)).toBe(text.mergeNone));
        expect(button(t('groups.people.mergeConfirmItem', { name: 'Cris' })).disabled).toBe(true);
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
        pickOption(text.mergeInto, 'Bea');
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
        expect(descriptionOf(button(text.cancel))).toBe(t('groups.people.makeOwnerQuestion', { name: 'Bea' }));

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

    it('is not offered on a member who deleted their account', async () => {
        await edit(trip(ana, { members: [ana, bea, cris, person('')] }));
        const gone = t('groups.names.deleted');

        fireEvent.click(row(gone));

        expect(button(t('groups.people.removeItem', { name: gone }))).toBeDefined();
        expect(screen.queryByRole('button', { name: t('groups.people.makeOwnerItem', { name: gone }) })).toBeNull();
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
    function friendOf(name: string, closed: SharedGroup['closed'] = null) {
        const me = person(TEST_USER.name, { role: 'owner' });
        return sampleGroup({ kind: 'direct', name: null, members: [me, person(name)], me: me.id, closed });
    }

    const eva = friendOf('Eva');

    async function editWith(
        group: SharedGroup,
        friends: SharedGroup[] = [eva, friendOf('Fran', 'deleted')],
        memberUsers: Record<string, string> = {}
    ) {
        const api = createFakeApi({ groups: [group, ...friends], memberUsers });
        stubApi(api.handler);
        const app = renderApp({ path: `/groups/${group.id}/edit` });
        await screen.findByRole('heading', { level: 2, name: text.title });
        openSearch();
        const sync = () => act(() => app.queryClient.invalidateQueries({ queryKey: GROUPS_KEY }));
        return { api, members: () => api.groups[0]!.members, sync };
    }

    function choose(name: string) {
        fireEvent.click(
            within(screen.getByRole('list', { name: en.groups.search.results })).getByRole('button', { name })
        );
    }

    function place() {
        return screen.queryByRole('combobox', { name: t('groups.people.placeOf', { name: 'Eva' }) });
    }

    describe('what the search says while the person types', () => {
        const status = () => document.querySelector('.person-search [role="status"]')!;

        it('says how many friends match, once the typing pauses, and nothing before anything is typed', async () => {
            await editWith(sampleGroup({ members: [ana, bea], me: ana.id }), [friendOf('Eva'), friendOf('Evelyn')]);
            expect(status().textContent).toBe('');

            search('ev');
            expect(status().textContent).toBe('');

            await waitFor(() => expect(status().textContent).toBe(t('groups.search.found', { count: 2 })), {
                timeout: 2_000,
            });
        });

        it('says one person, and then nobody, as the typing goes on', async () => {
            await editWith(sampleGroup({ members: [ana, bea], me: ana.id }), [friendOf('Eva'), friendOf('Evelyn')]);

            search('evel');
            await waitFor(() => expect(status().textContent).toBe(t('groups.search.found', { count: 1 })), {
                timeout: 2_000,
            });

            search('evelx');
            await waitFor(() => expect(status().textContent).toBe(t('groups.search.nobody')), { timeout: 2_000 });
        });

        it('leaves the words of a person who was just added alone', async () => {
            await editWith(sampleGroup({ members: [ana, bea], me: ana.id }), [friendOf('Eva')]);

            search('eva');
            fireEvent.click(
                within(screen.getByRole('list', { name: en.groups.search.results })).getByRole('button', {
                    name: 'Eva',
                })
            );

            await waitFor(() => expect(status().textContent).toBe(t('groups.search.added', { name: 'Eva' })));
        });
    });

    it('lists the open friends and adds one as a new member, who has joined', async () => {
        const { members } = await editWith(sampleGroup({ members: [ana, bea], me: ana.id }));

        expect(offered()).toEqual(['Eva']);
        choose('Eva');

        await waitFor(() => expect(rows()).toHaveLength(3));
        expect(rows()[2]).toBe(`Eva${t('groups.balance.memberSettled', { name: 'Eva' })}`);
        expect(members().at(-1)).toMatchObject({ name: 'Eva', claimed: true });
        expect(screen.getByText(t('groups.search.added', { name: 'Eva' }))).toBeDefined();
    });

    it('asks the owner whether the friend comes in as a new member or in place of a dummy', async () => {
        const { members } = await editWith(trip());

        choose('Eva');
        const label = t('groups.people.placeOf', { name: 'Eva' });
        expect(optionNames(label)).toEqual([text.asNew, t('groups.people.inPlaceOf', { name: 'Cris' })]);
        expect(chosenOption(label)).toBe(text.asNew);
        pickOption(label, t('groups.people.inPlaceOf', { name: 'Cris' }));
        fireEvent.click(button(text.addFriend));

        await waitFor(() => expect(rows()).toHaveLength(3));
        expect(rows()[2]).toMatch(/^Eva/);
        const added = members().at(-1)!;
        expect(members().find((member) => member.id === cris.id)?.mergedInto).toBe(added.id);
        await waitFor(() => expect(place()).toBeNull());
        expect(document.activeElement).toBe(field(en.groups.search.field));
    });

    it('goes back to the search by the way back of the sheet, with nothing sent', async () => {
        const { api } = await editWith(trip());

        choose('Eva');
        fireEvent.click(button(en.groups.search.close));

        await waitFor(() => expect(place()).toBeNull());
        expect(offered()).toEqual(['Eva']);
        expect(api.groupRequests).toEqual([]);
    });

    describe('who is a member already', () => {
        const friendDani = friendOf('Dani');
        const friendBea = friendOf('Bea');
        const users = {
            [friendDani.members[1]!.id]: 'dani',
            [dani.id]: 'dani',
            [friendBea.members[1]!.id]: 'bea',
            [bea.id]: 'bea',
        };
        const noDummies = () => sampleGroup({ name: 'Lisbon', members: [ana, bea, dani], me: ana.id });

        it('offers a friend who left like the rest, and brings them back into the row they had', async () => {
            const { members } = await editWith(noDummies(), [friendDani, friendBea], users);

            expect(offered()).toEqual(['Dani', 'Bea']);
            choose('Dani');

            await waitFor(() => expect(rows()).toHaveLength(3));
            expect(rows()[2]).toBe(`Dani${t('groups.balance.memberSettled', { name: 'Dani' })}`);
            expect(members()).toHaveLength(3);
            expect(members().find((member) => member.id === dani.id)?.leftAt).toBeNull();
        });

        it('puts a friend who left in place of a dummy, merged into the row they had', async () => {
            const { members } = await editWith(trip(), [friendDani], users);

            choose('Dani');
            pickOption(t('groups.people.placeOf', { name: 'Dani' }), t('groups.people.inPlaceOf', { name: 'Cris' }));
            fireEvent.click(button(text.addFriend));

            await waitFor(() => expect(rows()).toHaveLength(3));
            expect(rows()[2]).toMatch(/^Dani/);
            expect(members().find((member) => member.id === cris.id)?.mergedInto).toBe(dani.id);
            expect(members()).toHaveLength(4);
        });

        it('says in words that a friend who has not left is in the group already', async () => {
            const { members } = await editWith(noDummies(), [friendDani, friendBea], users);

            choose('Bea');

            expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.alreadyMember);
            expect(rows()).toHaveLength(2);
            expect(members()).toHaveLength(3);
        });
    });

    it('drops a friend who is gone after a sync', async () => {
        const { api, sync } = await editWith(trip(), [eva, friendOf('Gil')]);

        api.groups.find((group) => group.id === eva.id)!.closed = 'deleted';
        await sync();

        await waitFor(() => expect(offered()).toEqual(['Gil']));
    });

    it('goes back to a new member when the dummy chosen is gone after a sync', async () => {
        const { api, members, sync } = await editWith(trip());
        choose('Eva');
        pickOption(t('groups.people.placeOf', { name: 'Eva' }), t('groups.people.inPlaceOf', { name: 'Cris' }));

        api.groups[0]!.members.find((member) => member.id === cris.id)!.leftAt = 2;
        await sync();

        await waitFor(() => expect(rows()).toHaveLength(2));
        fireEvent.click(button(text.addFriend));

        await waitFor(() => expect(rows()).toHaveLength(3));
        expect(members().find((member) => member.id === cris.id)?.mergedInto).toBeNull();
    });

    it('asks nothing of a member who is not the owner', async () => {
        const { members } = await editWith(trip(bea));

        choose('Eva');

        expect(place()).toBeNull();
        await waitFor(() => expect(members().at(-1)).toMatchObject({ name: 'Eva' }));
    });

    it.each([
        ['already-member', en.groups.failure.alreadyMember],
        ['unknown-friend', en.groups.failure.unknownFriend],
        ['not-placeholder', en.groups.failure.notPlaceholder],
        ['too-many-groups', t('groups.failure.friendTooManyGroups', { max: MAX_OPEN_GROUPS })],
        ['too-many-closed-groups', t('groups.failure.friendTooManyClosedGroups', { max: MAX_CLOSED_GROUPS })],
    ])('says in words why the server refused it (%s)', async (error, words) => {
        const { api } = await editWith(trip());
        api.state.groupRefusal = { status: 409, error };

        choose('Eva');
        fireEvent.click(button(text.addFriend));

        expect((await screen.findByRole('alert')).textContent).toBe(words);
        expect(rows()).toHaveLength(3);
    });

    it('does not offer a friend who is no longer one', async () => {
        await editWith(trip(), [eva, friendOf('', 'deleted')]);

        expect(offered()).toEqual(['Eva']);
        search('E');
        expect(offered()).toEqual(['Eva', t('groups.search.byName', { name: 'E' }) + en.groups.search.byNameHint]);
    });

    it('turns the rows off without a connection', async () => {
        await editWith(trip());

        onlineManager.setOnline(false);

        await waitFor(() => expect(button('Eva').disabled).toBe(true));
    });
});

describe('without a connection', () => {
    it('turns adding and the actions of every person off', async () => {
        await edit(trip());

        onlineManager.setOnline(false);

        await screen.findByText(en.groups.offline);
        expect(button(text.add).disabled).toBe(true);
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
