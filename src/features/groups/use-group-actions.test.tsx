import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, GROUPS_KEY, PENDING_INVITATIONS_KEY, pendingInvitationsQuery } from '@/lib/api';
import { useGroupOutbox } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { sampleEntry, sampleGroup } from '@/lib/test/groups';
import { renderAppHook, stubApi } from '@/lib/test/render-app';
import { DEFAULT_CURRENCY } from '@core/money';

import { LocalRefusal } from './local-refusal';
import { useGroupActions } from './use-group-actions';
import { useGroups, useLedgers } from './use-ledgers';

import type { PendingInvitation } from '@core/invitation';
import type { SharedGroup } from '@core/shared-group';

type Actions = ReturnType<typeof useGroupActions>;

const friend = sampleGroup({ kind: 'direct', name: null });

async function setup(groups: SharedGroup[], options: Parameters<typeof createFakeApi>[0] = {}) {
    const api = createFakeApi({ groups: [...groups, friend], ...options });
    stubApi(api.handler);
    const rendered = renderAppHook(() => ({
        actions: useGroupActions(),
        client: useQueryClient(),
        groups: useGroups().groups,
        ledgers: useLedgers().ledgers,
        outbox: useGroupOutbox(),
    }));
    await waitFor(() => expect(rendered.result.current.ledgers.map((ledger) => ledger.hasData)).not.toContain(false));
    await waitFor(() => expect(rendered.result.current.groups).toHaveLength(groups.length + 1));
    const groupOf = (id: string) => rendered.result.current.groups.find((group) => group.id === id);
    const writes = () => api.requests.filter((request) => !request.startsWith('GET'));
    const leaves = () => api.requests.filter((request) => request.startsWith('DELETE'));
    return { api, ...rendered, groupOf, writes, leaves };
}

const changes = (group: SharedGroup): Array<[string, (actions: Actions) => Promise<SharedGroup>]> => {
    const bea = group.members[1]!.id;
    return [
        ['renaming it', (actions) => actions.change(group.id, { name: 'Porto' })],
        ['adding a dummy', (actions) => actions.savePerson(group.id, crypto.randomUUID(), 'Cris')],
        ['adding a friend', (actions) => actions.addFriend(group.id, crypto.randomUUID(), { friend: friend.id })],
        ['removing a member', (actions) => actions.removeMember(group.id, bea)],
        ['merging a dummy', (actions) => actions.merge(group.id, crypto.randomUUID(), group.me)],
        ['handing it over', (actions) => actions.handOver(group.id, bea)],
        ['deleting it', (actions) => actions.remove(group.id)],
        ['leaving it', (actions) => actions.leave(group.id)],
    ];
};

afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('making groups and friends', () => {
    it('makes a group with its dummies in the currency of the app, owned by the person, and keeps it', async () => {
        const app = await setup([]);
        const [id, me, cris] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

        const group = await act(() =>
            app.result.current.actions.createGroup({ id, name: 'Lisbon', me, others: [{ id: cris, name: 'Cris' }] })
        );

        expect(group).toMatchObject({ id, kind: 'group', name: 'Lisbon', me, currency: DEFAULT_CURRENCY });
        expect(group.members.map((member) => [member.id, member.name, member.role])).toEqual([
            [me, TEST_USER.name, 'owner'],
            [cris, 'Cris', 'member'],
        ]);
        await waitFor(() => expect(app.groupOf(id)).toEqual(group));
        expect(app.api.groups.find((item) => item.id === id)).toEqual(group);
    });

    it('makes a friend of a person by name', async () => {
        const app = await setup([]);
        const [id, me, ines] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];

        const made = await act(() =>
            app.result.current.actions.createFriend({ id, me, other: { id: ines, name: 'Inés' } })
        );

        expect(made).toMatchObject({ id, kind: 'direct', name: null, me, currency: DEFAULT_CURRENCY });
        expect(made.members.map((member) => member.name)).toEqual([TEST_USER.name, 'Inés']);
        await waitFor(() => expect(app.groupOf(id)).toEqual(made));
    });

    it('makes one group when the same make is sent again after its answer was lost', async () => {
        const app = await setup([]);
        const input = { id: crypto.randomUUID(), name: 'Lisbon', me: crypto.randomUUID(), others: [] };
        let lost = false;
        stubApi(async (url, init) => {
            const response = await app.api.handler(url, init);
            if (init?.method !== 'PUT' || lost) return response;
            lost = true;
            throw new TypeError('Failed to fetch');
        });

        await expect(app.result.current.actions.createGroup(input)).rejects.toThrow('Failed to fetch');
        await act(() => app.result.current.actions.createGroup(input));

        expect(app.api.groups.filter((group) => group.id === input.id)).toHaveLength(1);
        await waitFor(() => expect(app.groupOf(input.id)).toEqual(app.api.groups.at(-1)));
    });
});

describe('a change needs a connection', () => {
    const group = sampleGroup();
    const offline: Array<[string, (actions: Actions) => Promise<SharedGroup>]> = [
        ...changes(group),
        [
            'making a group',
            (actions) =>
                actions.createGroup({ id: crypto.randomUUID(), name: 'Lisbon', me: crypto.randomUUID(), others: [] }),
        ],
        [
            'making a friend',
            (actions) =>
                actions.createFriend({
                    id: crypto.randomUUID(),
                    me: crypto.randomUUID(),
                    other: { id: crypto.randomUUID(), name: 'Inés' },
                }),
        ],
        ['switching Show in my expenses', (actions) => actions.setSwitches(group.id, { showInExpenses: false })],
    ];

    it.each(offline)('refuses %s offline before anything is sent', async (_, change) => {
        const app = await setup([structuredClone(group)]);
        onlineManager.setOnline(false);

        const refused = change(app.result.current.actions);

        await expect(refused).rejects.toBeInstanceOf(LocalRefusal);
        await expect(refused).rejects.toMatchObject({ code: 'offline' });
        expect(app.writes()).toEqual([]);
        expect(app.groupOf(group.id)).toEqual(group);
    });
});

describe('a closed group is read-only', () => {
    const group = sampleGroup({ closed: 'deleted' });

    it.each(changes(group))('refuses %s before anything is sent', async (_, change) => {
        const app = await setup([structuredClone(group)]);

        await expect(change(app.result.current.actions)).rejects.toMatchObject({ code: 'read-only' });
        expect(app.writes()).toEqual([]);
    });

    it('still takes the switches of the person: archive it, and take it out of their expenses', async () => {
        const app = await setup([structuredClone(group)]);

        await act(() => app.result.current.actions.setSwitches(group.id, { archived: true, showInExpenses: false }));

        await waitFor(() =>
            expect(app.groupOf(group.id)).toMatchObject({ closed: 'deleted', archived: true, showInExpenses: false })
        );
    });
});

describe('the links to be friends of the person', () => {
    const older: PendingInvitation = {
        id: '0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f',
        token: `0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.${'A'.repeat(43)}`,
        expiresAt: 1_000,
    };

    it('keeps a new link first in the list on the device, and the list the server answers to a revoke', async () => {
        const app = await setup([], { pending: [older] });
        const listed = () => app.result.current.client.getQueryData<PendingInvitation[]>(PENDING_INVITATIONS_KEY);
        await act(() => app.result.current.client.fetchQuery(pendingInvitationsQuery()));

        const made = await act(() => app.result.current.actions.inviteFriend());

        expect(listed()).toEqual([made, older]);
        await act(() => app.result.current.actions.revokeLink(made.id));
        expect(listed()).toEqual([older]);
        expect(app.api.groupRequests).toEqual(['POST /api/invitations', `DELETE /api/invitations/${made.id}`]);
    });

    it('keeps no list made only of the new link when the list was never read', async () => {
        const app = await setup([], { pending: [older] });

        await act(() => app.result.current.actions.inviteFriend());

        expect(app.result.current.client.getQueryData(PENDING_INVITATIONS_KEY)).toBeUndefined();
    });

    it.each([
        ['making one', (actions: Actions) => actions.inviteFriend()],
        ['revoking one', (actions: Actions) => actions.revokeLink(older.id)],
    ])('refuses %s offline before anything is sent', async (_, change) => {
        const app = await setup([], { pending: [older] });
        onlineManager.setOnline(false);

        const refused = change(app.result.current.actions);

        await expect(refused).rejects.toMatchObject({ code: 'offline' });
        expect(app.writes()).toEqual([]);
    });
});

describe('changing a group', () => {
    it('keeps what the server answers to each change on the device', async () => {
        const group = sampleGroup();
        const [bea, cris, dummy] = [group.members[1]!.id, crypto.randomUUID(), crypto.randomUUID()];
        const app = await setup([group]);
        const actions = () => app.result.current.actions;

        await act(() => actions().change(group.id, { name: 'Porto', simplifyDebts: true }));
        await act(() => actions().savePerson(group.id, dummy, 'Old Ana'));
        await act(() => actions().merge(group.id, dummy, group.me));
        await act(() => actions().addFriend(group.id, cris, { friend: friend.id }));
        await act(() => actions().removeMember(group.id, cris));
        await act(() => actions().handOver(group.id, bea));

        await waitFor(() => expect(app.groupOf(group.id)).toEqual(app.api.groups[0]));
        expect(app.groupOf(group.id)).toMatchObject({ name: 'Porto', simplifyDebts: true });
        expect(app.groupOf(group.id)!.members).toMatchObject([
            { id: group.me, role: 'member' },
            { id: bea, role: 'owner' },
            { id: dummy, name: 'Old Ana', mergedInto: group.me },
            { id: cris, name: friend.members[1]!.name, claimed: true, leftAt: expect.any(Number) },
        ]);
    });

    it('keeps a change over a read of the groups that started before it and answers after it', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        let release: () => void = () => undefined;
        const late = new Promise<void>((resolve) => {
            release = resolve;
        });
        stubApi(async (url, init) => {
            const response = await app.api.handler(url, init);
            if (url.pathname === '/api/groups' && (init?.method ?? 'GET') === 'GET') await late;
            return response;
        });
        const reading = app.result.current.client.refetchQueries({ queryKey: GROUPS_KEY });
        await waitFor(() => expect(app.api.requests.at(-1)).toBe('GET /api/groups'));

        await act(() => app.result.current.actions.change(group.id, { name: 'Porto' }));
        release();
        await reading;

        const kept = app.result.current.client.getQueryData<SharedGroup[]>(GROUPS_KEY);
        expect(kept?.find((item) => item.id === group.id)?.name).toBe('Porto');
    });

    it('closes a group the person deletes, and keeps it', async () => {
        const group = sampleGroup();
        const app = await setup([group]);

        await act(() => app.result.current.actions.remove(group.id));

        await waitFor(() => expect(app.groupOf(group.id)).toMatchObject({ closed: 'deleted' }));
    });

    it('leaves the group as it was, and hands over the reason, when the server refuses', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        app.api.state.groupRefusal = { status: 409, error: 'unsettled' };

        const refused = app.result.current.actions.remove(group.id);

        await expect(refused).rejects.toBeInstanceOf(ApiError);
        await expect(refused).rejects.toMatchObject({ status: 409, code: 'unsettled' });
        expect(app.groupOf(group.id)).toEqual(group);
    });
});

describe('leaving a group', () => {
    it("sends the person's writes to the group and pulls its changes before asking to leave", async () => {
        const group = sampleGroup();
        const stored = sampleEntry(group);
        const app = await setup([group], { entries: [stored] });
        onlineManager.setOnline(false);
        const mine = sampleEntry(group, { text: 'Mine' });
        await act(() => app.result.current.outbox.put(mine));
        app.api.serverWriteEntry({ ...stored, text: 'Edited by Bea', updatedAt: 2 }, group.members[1]!.id);
        onlineManager.setOnline(true);

        await act(() => app.result.current.actions.leave(group.id));

        expect(app.writes()).toEqual([
            `PUT /api/groups/${group.id}/entries/${mine.id}`,
            `DELETE /api/groups/${group.id}/members/${group.me}`,
        ]);
        expect(app.api.requests.indexOf(`GET /api/groups/${group.id}/entries?after=1`)).toBeLessThan(
            app.api.requests.indexOf(`DELETE /api/groups/${group.id}/members/${group.me}`)
        );
        await waitFor(() => expect(app.groupOf(group.id)).toMatchObject({ closed: 'left' }));
        expect(app.result.current.ledgers[0]!.entries.map((entry) => entry.text)).toEqual(['Edited by Bea', 'Mine']);
        expect(app.result.current.outbox.getState().pending).toEqual([]);
    });

    it('does not ask to leave, and says why, when a write to the group cannot be sent', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        const mine = sampleEntry(group);
        app.api.state.entryRefusal = { status: 503 };
        await act(() => app.result.current.outbox.put(mine));

        await expect(app.result.current.actions.leave(group.id)).rejects.toMatchObject({ code: 'unsynced' });

        expect(app.leaves()).toEqual([]);
        expect(app.result.current.outbox.getState().pending).toEqual([mine]);
        expect(app.groupOf(group.id)?.closed).toBeNull();
    });

    it('does not ask to leave a group that sending its writes finds closed, and says it is read-only', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        app.api.groups[0]!.closed = 'deleted';
        await act(() => app.result.current.outbox.put(sampleEntry(group)));

        const refused = app.result.current.actions.leave(group.id);

        await expect(refused).rejects.toBeInstanceOf(LocalRefusal);
        await expect(refused).rejects.toMatchObject({ code: 'read-only' });
        expect(app.leaves()).toEqual([]);
        expect(app.result.current.outbox.getState().rejected).toMatchObject([{ code: 'closed' }]);
    });

    it('says the group is read-only, with what stopped the push, when it closed and the push then failed', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        app.api.groups[0]!.closed = 'deleted';
        let writes = 0;
        stubApi((url, init) => {
            if (init?.method === 'PUT' && ++writes > 1) throw new TypeError('Failed to fetch');
            return app.api.handler(url, init);
        });
        await act(() => app.result.current.outbox.putAll([sampleEntry(group), sampleEntry(group)]));

        const refused = app.result.current.actions.leave(group.id);

        await expect(refused).rejects.toMatchObject({ code: 'read-only', cause: new TypeError('Failed to fetch') });
        expect(app.leaves()).toEqual([]);
    });

    it('does not ask to leave when the changes of the group cannot be pulled', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        app.api.state.offline = true;

        await expect(app.result.current.actions.leave(group.id)).rejects.toMatchObject({ code: 'unsynced' });

        expect(app.leaves()).toEqual([]);
    });

    it('does not ask to leave while a write to the group made meanwhile is still waiting', async () => {
        const group = sampleGroup();
        const app = await setup([group]);
        const release = app.api.hold();
        const leaving = app.result.current.actions.leave(group.id);
        await waitFor(() => expect(app.api.requests.at(-1)).toBe(`GET /api/groups/${group.id}/entries?after=0`));

        await act(() => app.result.current.outbox.put(sampleEntry(group)));
        release();

        await expect(leaving).rejects.toMatchObject({ code: 'unsynced' });
        expect(app.leaves()).toEqual([]);
    });
});
