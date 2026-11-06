import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import indexHtml from '/index.html?raw';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER, createFakeAuth } from '@/lib/test/fake-auth';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { MAX_CLOSED_GROUPS, MAX_FRIENDS } from '@core/shared-group';

import type { Refusal } from '@/lib/test/fake-groups';

const t = createTranslator({ locale: 'en', messages: en });

const TOKEN = `0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.${'A'.repeat(43)}`;
const PATH = `/join/${TOKEN}`;

function friendOfCarla() {
    const carla = person('Carla Ruiz', { role: 'owner' });
    const me = person('Ana Pérez');
    return sampleGroup({ kind: 'direct', name: null, me: me.id, members: [carla, me] });
}

function openLink(
    options: {
        refusals?: Partial<Record<'read' | 'accept' | 'decline', Refusal>>;
        known?: boolean;
        forDummy?: boolean;
    } = {}
) {
    const friend = friendOfCarla();
    const forDummy = options.forDummy ?? true;
    const incoming = options.known === false ? [] : [{ token: TOKEN, name: 'Carla', forDummy, friend }];
    const api = createFakeApi({ incoming });
    Object.assign(api.state.linkRefusals, options.refusals);
    stubApi(api.handler);
    return { api, friend };
}

function linkRequests(api: ReturnType<typeof createFakeApi>) {
    return api.requests.filter((request) => request.includes('/api/invitations/'));
}

async function asked() {
    return screen.findByText(t('groups.join.asks', { name: 'Carla' }));
}

afterEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
});

describe('the join page', () => {
    it('asks a person who is signed out to sign in first, and shows the invitation once they are', async () => {
        window.history.replaceState(null, '', PATH);
        openLink();
        const fakeAuth = createFakeAuth({ session: null });
        renderApp({ path: PATH, fakeAuth });

        expect(await screen.findByRole('heading', { name: en.auth.title })).toBeDefined();
        expect(screen.getByText(en.auth.invited)).toBeDefined();

        fakeAuth.state.session = TEST_USER;
        await act(() => fakeAuth.auth.check());

        expect(await asked()).toBeDefined();
    });

    it('shows who asks, and opens the friend once the person accepts', async () => {
        const { api, friend } = openLink();
        renderApp({ path: PATH });
        await asked();

        fireEvent.click(screen.getByRole('button', { name: en.groups.join.accept }));

        expect(await screen.findByRole('heading', { level: 1, name: 'Carla Ruiz' })).toBeDefined();
        expect(api.groups.map((group) => group.id)).toEqual([friend.id]);
        expect(linkRequests(api)).toEqual(['POST /api/invitations/read', 'POST /api/invitations/accept']);
    });

    it.each([
        ['a direct link, that the two become friends', false, 'groups.join.whatNew', 'groups.join.what'],
        ['the link of a dummy, that what was shared becomes theirs', true, 'groups.join.what', 'groups.join.whatNew'],
    ] as const)('says what accepting does: for %s', async (_, forDummy, said, unsaid) => {
        openLink({ forDummy });
        renderApp({ path: PATH });
        await asked();

        expect(screen.getByText(t(said, { name: 'Carla' }))).toBeDefined();
        expect(screen.queryByText(t(unsaid, { name: 'Carla' }))).toBeNull();
    });

    it('opens the friend a direct link makes once the person accepts', async () => {
        const { api, friend } = openLink({ forDummy: false });
        renderApp({ path: PATH });
        await asked();

        fireEvent.click(screen.getByRole('button', { name: en.groups.join.accept }));

        expect(await screen.findByRole('heading', { level: 1, name: 'Carla Ruiz' })).toBeDefined();
        expect(screen.queryByRole('button', { name: en.groups.join.accept })).toBeNull();
        expect(api.groups.map((group) => group.id)).toEqual([friend.id]);
    });

    it('says the invitation was declined, with the way to Groups', async () => {
        openLink();
        renderApp({ path: PATH });
        await asked();

        fireEvent.click(screen.getByRole('button', { name: en.groups.join.decline }));

        expect(await screen.findByText(en.groups.join.declined)).toBeDefined();
        expect(screen.getByRole('link', { name: en.groups.group.back })).toBeDefined();
        expect(screen.queryByRole('button', { name: en.groups.join.accept })).toBeNull();
    });

    it('says a link that cannot be used is gone, with the way to Groups', async () => {
        openLink({ known: false });
        renderApp({ path: PATH });

        expect(await screen.findByText(en.groups.join.gone)).toBeDefined();
        expect(screen.getByRole('link', { name: en.groups.group.back })).toBeDefined();
        expect(screen.queryByRole('button', { name: en.groups.join.accept })).toBeNull();
    });

    it('tells the person who made the link that it is their own', async () => {
        openLink({ refusals: { read: { status: 409, error: 'yourself' } } });
        renderApp({ path: PATH });

        expect(await screen.findByText(en.groups.join.yourself)).toBeDefined();
        expect(screen.queryByRole('button', { name: en.groups.join.accept })).toBeNull();
    });

    it('says the link is gone when somebody else used it meanwhile', async () => {
        openLink({ refusals: { accept: { status: 410, error: 'gone' } } });
        renderApp({ path: PATH });
        await asked();

        fireEvent.click(screen.getByRole('button', { name: en.groups.join.accept }));

        expect(await screen.findByText(en.groups.join.gone)).toBeDefined();
        expect(screen.queryByRole('button', { name: en.groups.join.accept })).toBeNull();
    });

    it.each([
        ['already-friends', t('groups.join.alreadyFriends', { name: 'Carla' })],
        ['too-many-friends', t('groups.failure.tooManyFriends', { max: MAX_FRIENDS })],
        ['too-many-closed-groups', t('groups.failure.tooManyClosedGroups', { max: MAX_CLOSED_GROUPS })],
        ['inviter-at-limit', t('groups.join.inviterAtLimit', { name: 'Carla' })],
    ])('says in words why accepting was refused (%s), and keeps Decline', async (error, words) => {
        openLink({ refusals: { accept: { status: 409, error } } });
        renderApp({ path: PATH });
        await asked();

        fireEvent.click(screen.getByRole('button', { name: en.groups.join.accept }));

        expect((await screen.findByRole('alert')).textContent).toBe(words);
        expect(screen.getByRole('button', { name: en.groups.join.decline })).toBeDefined();
    });

    it('says when the invitation could not be read, and reads it again on Try again', async () => {
        const { api } = openLink({ refusals: { read: { status: 500 } } });
        renderApp({ path: PATH });

        expect((await screen.findByRole('alert')).textContent).toBe(en.groups.join.loadFailed);

        api.state.linkRefusals = {};
        fireEvent.click(screen.getByRole('button', { name: en.groups.join.retry }));

        expect(await asked()).toBeDefined();
    });

    it('needs a connection: offline it says so and sends nothing, and shows the invitation once back', async () => {
        const { api } = openLink();
        onlineManager.setOnline(false);
        renderApp({ path: PATH });

        expect(await screen.findByText(en.groups.join.offline)).toBeDefined();
        expect(linkRequests(api)).toEqual([]);

        onlineManager.setOnline(true);

        expect(await asked()).toBeDefined();
    });

    it('turns Accept and Decline off while offline', async () => {
        const { api } = openLink();
        renderApp({ path: PATH });
        await asked();

        act(() => onlineManager.setOnline(false));

        expect(screen.getByText(en.groups.join.offline)).toBeDefined();
        for (const name of [en.groups.join.accept, en.groups.join.decline]) {
            expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
        }
        await waitFor(() => expect(linkRequests(api)).toEqual(['POST /api/invitations/read']));
    });

    it('is reached from a page that tells other sites only its origin', () => {
        expect(indexHtml).toContain('<meta name="referrer" content="strict-origin" />');
    });
});
