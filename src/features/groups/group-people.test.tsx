import { onlineManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import es from '@/assets/locales/es.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { formatAmount } from '@core/money';
import { MAX_GROUP_MEMBERS, type GroupMember, type SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });
const text = en.groups.people;

function euros(cents: number) {
    return formatAmount(cents, 'EUR', 'en');
}

const ana = person('Ana', { role: 'owner' });
const bea = person('Bea');
const cris = person('Cris', { claimed: false });
const dani = person('Dani', { leftAt: 1 });

// Ana, the test user, paid a dinner with Bea, who owes her €10.00; Cris is a dummy and Dani left
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

describe('without a connection', () => {
    it('turns adding and the actions of every person off', async () => {
        await edit(trip());

        onlineManager.setOnline(false);

        await screen.findByText(en.groups.offline);
        expect(field(text.add).disabled).toBe(true);
        expect(button(text.addSubmit).disabled).toBe(true);
        fireEvent.click(row('Bea'));
        expect(button(t('groups.people.renameItem', { name: 'Bea' })).disabled).toBe(true);
        expect(button(t('groups.people.removeItem', { name: 'Bea' })).disabled).toBe(true);
    });
});

describe('in Spanish', () => {
    it('names each action by words that hold what it shows', async () => {
        localStorage.setItem('tarja:locale', 'es');
        const group = trip();
        stubApi(createFakeApi({ groups: [group] }).handler);
        renderApp({ path: `/groups/${group.id}/edit` });
        const people = await screen.findByRole('heading', { level: 2, name: es.groups.people.title });

        fireEvent.click(within(people.closest('section')!).getByRole('button', { name: /^Bea/ }));

        const actions = within(people.closest('section')!)
            .getAllByRole('button')
            .filter((action) => action.hasAttribute('aria-label'));
        expect(actions).toHaveLength(2);
        for (const action of actions) {
            expect(action.getAttribute('aria-label')!.toLowerCase()).toContain(action.textContent!.toLowerCase());
        }
    });
});
