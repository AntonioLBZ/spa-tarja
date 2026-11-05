import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { INVITATION_DAYS, type FriendInvitation } from '@core/invitation';

import type { SharedGroup } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });

const TOKEN = `0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.${'A'.repeat(43)}`;

// A friend of the test user, Ana, whose other side is Bruno, a dummy unless told otherwise
function friendWithBruno(overrides: Partial<SharedGroup> = {}, claimed = false) {
    const ana = person('Ana', { role: 'owner' });
    return sampleGroup({
        kind: 'direct',
        name: null,
        me: ana.id,
        members: [ana, person('Bruno', { claimed })],
        ...overrides,
    });
}

function openSettings(group: SharedGroup, friendInvitations: Record<string, FriendInvitation> = {}) {
    const api = createFakeApi({ groups: [group], friendInvitations });
    stubApi(api.handler);
    renderApp({ path: `/groups/${group.id}/edit` });
    return api;
}

function linkField() {
    return screen.findByRole<HTMLInputElement>('textbox', { name: en.groups.invite.link });
}

function day(expiresAt: number) {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(expiresAt));
}

function lend(name: 'clipboard' | 'share', value: unknown) {
    Object.defineProperty(navigator, name, { value, configurable: true });
}

afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(navigator, 'share');
});

describe('the invitation of a friend', () => {
    it('is in the settings of a friend whose other side is a dummy', async () => {
        openSettings(friendWithBruno());

        expect(await screen.findByRole('heading', { name: en.groups.invite.title })).toBeDefined();
        expect(screen.getByText(t('groups.invite.hint', { name: 'Bruno', days: INVITATION_DAYS }))).toBeDefined();
    });

    it.each([
        ['a friend who is a person', friendWithBruno({}, true)],
        ['a friend that was removed', friendWithBruno({ closed: 'deleted' })],
        ['a group', sampleGroup({ members: [person('Ana', { role: 'owner' }), person('Bruno', { claimed: false })] })],
    ])('is not in the settings of %s', async (_, group) => {
        const api = openSettings(group);
        await screen.findByRole('checkbox', { name: en.groups.edit.show });

        expect(screen.queryByRole('heading', { name: en.groups.invite.title })).toBeNull();
        expect(api.requests.filter((request) => request.includes('/invitations'))).toEqual([]);
    });

    it('makes a link and shows it, with the day it stops working, and the focus on it', async () => {
        const friend = friendWithBruno();
        const api = openSettings(friend);

        fireEvent.click(await screen.findByRole('button', { name: en.groups.invite.make }));

        const field = await linkField();
        const made = api.friendInvitations.get(friend.id);
        if (made?.state !== 'open') throw new Error('No link was made');
        expect(field.value).toBe(`${window.location.origin}/join/${made.token}`);
        expect(field.readOnly).toBe(true);
        await waitFor(() => expect(document.activeElement).toBe(field));
        expect(screen.getByText(t('groups.invite.until', { date: day(made.expiresAt) }))).toBeDefined();
        expect(api.groupRequests).toEqual([`POST /api/groups/${friend.id}/invitations`]);
    });

    it('lists the open link it had, and copies it', async () => {
        const friend = friendWithBruno();
        const writeText = vi.fn(async () => undefined);
        lend('clipboard', { writeText });
        openSettings(friend, { [friend.id]: { state: 'open', token: TOKEN, expiresAt: Date.now() } });

        expect((await linkField()).value).toBe(`${window.location.origin}/join/${TOKEN}`);
        fireEvent.click(screen.getByRole('button', { name: en.groups.invite.copy }));

        expect(await screen.findByText(en.groups.invite.copied)).toBeDefined();
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/${TOKEN}`);
    });

    it('hands the link to the share sheet where the device has one', async () => {
        const friend = friendWithBruno();
        const share = vi.fn(async () => undefined);
        lend('share', share);
        openSettings(friend, { [friend.id]: { state: 'open', token: TOKEN, expiresAt: Date.now() } });

        fireEvent.click(await screen.findByRole('button', { name: en.groups.invite.share }));

        await waitFor(() => expect(share).toHaveBeenCalledWith({ url: `${window.location.origin}/join/${TOKEN}` }));
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('says nothing when the person closes the share sheet', async () => {
        const friend = friendWithBruno();
        const share = vi.fn(async () => {
            throw new DOMException('Share canceled', 'AbortError');
        });
        lend('share', share);
        openSettings(friend, { [friend.id]: { state: 'open', token: TOKEN, expiresAt: Date.now() } });

        fireEvent.click(await screen.findByRole('button', { name: en.groups.invite.share }));

        await waitFor(() => expect(share).toHaveBeenCalled());
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('says when the link could not be copied, so it can be copied by hand', async () => {
        const friend = friendWithBruno();
        lend('clipboard', { writeText: vi.fn(async () => Promise.reject(new Error('Denied'))) });
        openSettings(friend, { [friend.id]: { state: 'open', token: TOKEN, expiresAt: Date.now() } });

        fireEvent.click(await screen.findByRole('button', { name: en.groups.invite.copy }));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.invite.sendFailed);
    });

    it('revokes the open link, and offers to make one again', async () => {
        const friend = friendWithBruno();
        const api = openSettings(friend, { [friend.id]: { state: 'open', token: TOKEN, expiresAt: Date.now() } });

        await linkField();
        fireEvent.click(screen.getByRole('button', { name: en.groups.invite.revoke }));

        const make = await screen.findByRole('button', { name: en.groups.invite.make });
        await waitFor(() => expect(document.activeElement).toBe(make));
        expect(screen.queryByRole('textbox', { name: en.groups.invite.link })).toBeNull();
        expect(api.groupRequests).toEqual([`DELETE /api/groups/${friend.id}/invitations`]);
    });

    it('says the invitation was declined, and makes another', async () => {
        const friend = friendWithBruno();
        openSettings(friend, { [friend.id]: { state: 'declined' } });

        expect(await screen.findByText(en.groups.invite.declined)).toBeDefined();
        fireEvent.click(screen.getByRole('button', { name: en.groups.invite.makeAnother }));

        expect(await linkField()).toBeDefined();
        expect(screen.queryByText(en.groups.invite.declined)).toBeNull();
    });

    it('says a refusal in words', async () => {
        const friend = friendWithBruno();
        const api = openSettings(friend);
        api.state.groupRefusal = { status: 409, error: 'not-placeholder' };

        fireEvent.click(await screen.findByRole('button', { name: en.groups.invite.make }));

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.failure.notPlaceholder);
    });

    it('offers to make a link when the one it had could not be read, while online', async () => {
        const friend = friendWithBruno();
        const api = createFakeApi({ groups: [friend] });
        stubApi((url, init) => {
            const reads = url.pathname === `/api/groups/${friend.id}/invitations` && (init?.method ?? 'GET') === 'GET';
            return reads ? new Response(null, { status: 500 }) : api.handler(url, init);
        });
        renderApp({ path: `/groups/${friend.id}/edit` });

        expect(await screen.findByText(en.groups.invite.loadFailed)).toBeDefined();
        fireEvent.click(await screen.findByRole('button', { name: en.groups.invite.make }));

        expect(await linkField()).toBeDefined();
    });

    it('catches up with a friend who accepted since the groups were read, instead of offering a link', async () => {
        const friend = friendWithBruno();
        const api = createFakeApi({ groups: [friend] });
        stubApi(api.handler);
        renderApp({ path: `/groups/${friend.id}` });
        const link = await screen.findByRole('link', { name: en.groups.edit.linkFriend });
        const claimed = api.groups[0]?.members.find((member) => member.id !== friend.me);
        if (claimed) claimed.claimed = true;

        fireEvent.click(link);

        await screen.findByRole('heading', { name: en.groups.invite.title });
        await waitFor(() => expect(screen.queryByRole('heading', { name: en.groups.invite.title })).toBeNull());
        expect(api.requests.filter((request) => request === 'GET /api/groups')).toHaveLength(2);
    });

    it('is off while offline', async () => {
        openSettings(friendWithBruno());
        const make = (await screen.findByRole('button', { name: en.groups.invite.make })) as HTMLButtonElement;

        act(() => onlineManager.setOnline(false));

        expect(make.disabled).toBe(true);
    });
});
