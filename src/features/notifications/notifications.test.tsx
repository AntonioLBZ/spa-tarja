import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import en from '@/assets/locales/en.json';
import { GROUPS_KEY } from '@/lib/api';
import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { installFakePush } from '@/lib/test/fake-push';
import { person, sampleGroup } from '@/lib/test/groups';
import { renderApp, stubApi } from '@/lib/test/render-app';

import type { SharedGroup } from '@core/shared-group';

let push: ReturnType<typeof installFakePush> | null = null;

afterEach(() => {
    push?.uninstall();
    push = null;
    localStorage.clear();
    onlineManager.setOnline(true);
});

async function openSettings(groups: SharedGroup[] = []) {
    const api = createFakeApi({ groups });
    stubApi(api.handler);
    const app = renderApp({ path: '/settings' });
    await screen.findByRole('heading', { name: en.settings.notifications.title });
    return { api, app };
}

function toggle() {
    return screen.getByRole('checkbox', { name: en.settings.notifications.toggle }) as HTMLInputElement;
}

describe('the switch of notifications in the settings', () => {
    it('says the browser has no push, and is off', async () => {
        await openSettings();

        expect(screen.getByText(en.settings.notifications.unsupported)).toBeDefined();
        expect(toggle().disabled).toBe(true);
    });

    it('says how to allow them once they were blocked, and is off', async () => {
        push = installFakePush({ permission: 'denied' });
        await openSettings();

        expect(await screen.findByText(en.settings.notifications.denied)).toBeDefined();
        expect(toggle().disabled).toBe(true);
    });

    it('asks the permission, subscribes and hands the subscription to the server in the language of the app', async () => {
        push = installFakePush();
        const { api } = await openSettings();

        fireEvent.click(toggle());

        await waitFor(() => expect(toggle().checked).toBe(true));
        expect(push.requestPermission).toHaveBeenCalledOnce();
        expect(push.pushManager.subscribe).toHaveBeenCalledWith({
            userVisibleOnly: true,
            applicationServerKey: 'B'.repeat(87),
        });
        expect(api.pushBodies).toEqual([
            {
                method: 'PUT',
                body: expect.objectContaining({ endpoint: push.state.subscription?.endpoint, locale: 'en' }),
            },
        ]);
    });

    it('stays off when the browser is not allowed to show them', async () => {
        push = installFakePush({ answer: 'denied' });
        const { api } = await openSettings();

        fireEvent.click(toggle());

        expect(await screen.findByText(en.settings.notifications.denied)).toBeDefined();
        expect(toggle().checked).toBe(false);
        expect(api.pushBodies).toEqual([]);
    });

    it('takes the subscription away from the browser too when the server refuses it, and stays off', async () => {
        push = installFakePush();
        const { api } = await openSettings();
        api.state.pushWriteStatus = 400;

        fireEvent.click(toggle());

        expect(await screen.findByText(en.settings.notifications.failed)).toBeDefined();
        expect(toggle().checked).toBe(false);
        expect(push.state.subscription).toBeNull();
    });

    it('turns off a subscription the server refuses to know of', async () => {
        push = installFakePush({ permission: 'granted', subscribed: true });
        const subscription = push.state.subscription!;
        const { api } = await openSettings();
        await waitFor(() => expect(toggle().checked).toBe(true));
        api.state.pushWriteStatus = 400;

        fireEvent.click(toggle());

        await waitFor(() => expect(toggle().checked).toBe(false));
        expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    it('takes the subscription away from the server and from the browser', async () => {
        push = installFakePush({ permission: 'granted', subscribed: true });
        const subscription = push.state.subscription!;
        const { api } = await openSettings();
        await waitFor(() => expect(toggle().checked).toBe(true));

        fireEvent.click(toggle());

        await waitFor(() => expect(toggle().checked).toBe(false));
        expect(api.pushBodies).toContainEqual({ method: 'DELETE', body: { endpoint: subscription.endpoint } });
        expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    it('is off without a connection, and says so', async () => {
        push = installFakePush();
        await openSettings();

        act(() => onlineManager.setOnline(false));

        expect(await screen.findByText(en.settings.notifications.offline)).toBeDefined();
        expect(toggle().disabled).toBe(true);
    });
});

describe('the suggestion on the screen of a group', () => {
    const bea = person('Bea');
    const shared = sampleGroup({ name: 'Flat', members: [person('Ana', { role: 'owner' }), bea] });

    async function openGroup(group: SharedGroup) {
        const api = createFakeApi({ groups: [{ ...group, me: group.members[0]!.id }] });
        stubApi(api.handler);
        const app = renderApp({ path: `/groups/${group.id}` });
        await screen.findByRole('heading', { name: group.name ?? '', level: 1 });
        return { api, app };
    }

    it('suggests turning them on in a group with somebody else who uses the app', async () => {
        push = installFakePush();
        await openGroup(shared);

        expect(await screen.findByText(en.groups.pushSuggestion.text)).toBeDefined();
    });

    it('goes for good once it is answered with Not now', async () => {
        push = installFakePush();
        const { app } = await openGroup(shared);
        fireEvent.click(await screen.findByRole('button', { name: en.groups.pushSuggestion.notNow }));

        expect(screen.queryByText(en.groups.pushSuggestion.text)).toBeNull();
        app.unmount();
        await openGroup(shared);
        expect(screen.queryByText(en.groups.pushSuggestion.text)).toBeNull();
        expect(localStorage.getItem(`tarja:push-suggestion:${TEST_USER.id}`)).not.toBeNull();
    });

    it('turns them on from its button', async () => {
        push = installFakePush();
        const { api } = await openGroup(shared);

        fireEvent.click(await screen.findByRole('button', { name: en.groups.pushSuggestion.turnOn }));

        await waitFor(() => expect(api.pushBodies).toHaveLength(1));
        expect(screen.queryByText(en.groups.pushSuggestion.text)).toBeNull();
    });

    it('says nothing in a group of dummies, nor once the browser was asked', async () => {
        push = installFakePush();
        const dummies = sampleGroup({
            name: 'Trip',
            members: [person('Ana', { role: 'owner' }), person('Dummy', { claimed: false })],
        });
        const { app } = await openGroup(dummies);
        expect(screen.queryByText(en.groups.pushSuggestion.text)).toBeNull();
        app.unmount();
        push.uninstall();

        push = installFakePush({ permission: 'denied' });
        await openGroup(shared);

        expect(screen.queryByText(en.groups.pushSuggestion.text)).toBeNull();
    });
});

describe('the page and the service worker', () => {
    it('asks the groups again when a push comes in while it is in sight', async () => {
        push = installFakePush();
        const { api, app } = await openSettings();
        await waitFor(() => expect(app.queryClient.getQueryState(GROUPS_KEY)?.status).toBe('success'));
        const before = api.requests.filter((request) => request === 'GET /api/groups').length;

        act(() => push!.post({ type: 'sync' }));

        await waitFor(() =>
            expect(api.requests.filter((request) => request === 'GET /api/groups').length).toBe(before + 1)
        );
    });

    it('opens the group of a notification that was tapped', async () => {
        push = installFakePush();
        const flat = sampleGroup({ name: 'Flat' });
        await openSettings([flat]);

        act(() => push!.post({ type: 'open', path: `/groups/${flat.id}` }));

        expect(await screen.findByRole('heading', { name: 'Flat', level: 1 })).toBeDefined();
    });

    it('sends the subscription again when the app opens, so the server has its address and language', async () => {
        push = installFakePush({ permission: 'granted', subscribed: true });
        const { api } = await openSettings();

        await waitFor(() =>
            expect(api.pushBodies).toContainEqual({ method: 'PUT', body: expect.objectContaining({ locale: 'en' }) })
        );
    });

    it('takes the subscription away when the person signs out', async () => {
        push = installFakePush({ permission: 'granted', subscribed: true });
        const subscription = push.state.subscription!;
        const { api } = await openSettings();

        fireEvent.click(screen.getByRole('button', { name: en.settings.account.signOut }));

        await waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled());
        expect(api.pushBodies).toContainEqual({ method: 'DELETE', body: { endpoint: subscription.endpoint } });
    });
});

describe('the privacy notice', () => {
    it('says what notifications keep and who carries them', async () => {
        await openSettings();

        fireEvent.click(screen.getByRole('button', { name: en.privacy.open }));

        expect(await screen.findByText(en.privacy.stored.push)).toBeDefined();
        expect(screen.getByText(en.privacy.others.push)).toBeDefined();
    });
});
