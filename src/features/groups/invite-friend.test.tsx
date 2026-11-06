import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createTranslator } from 'use-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/assets/locales/en.json';
import { createFakeApi } from '@/lib/test/fake-api';
import { renderApp, stubApi } from '@/lib/test/render-app';
import { INVITATION_DAYS, type PendingInvitation } from '@core/invitation';
import { MAX_OPEN_INVITATIONS } from '@core/shared-group';

const t = createTranslator({ locale: 'en', messages: en });

function pendingLink(expiresAt = Date.now() + 1_000): PendingInvitation {
    const id = crypto.randomUUID();
    return { id, token: `${id}.${'A'.repeat(43)}`, expiresAt };
}

function openGroups(pending: PendingInvitation[] = []) {
    const api = createFakeApi({ pending });
    stubApi(api.handler);
    renderApp({ path: '/groups' });
    return api;
}

function urlOf(link: PendingInvitation) {
    return `${window.location.origin}/join/${link.token}`;
}

function inviteButton() {
    return screen.findByRole<HTMLButtonElement>('button', { name: en.groups.links.make });
}

function linkFields() {
    return screen.queryAllByRole<HTMLInputElement>('textbox', { name: en.groups.invite.link });
}

function day(expiresAt: number) {
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(expiresAt));
}

afterEach(() => {
    onlineManager.setOnline(true);
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'clipboard');
});

describe('inviting a friend from the Groups tab', () => {
    it('is there with its hint also before there is any group', async () => {
        openGroups();

        expect(await screen.findByText(en.groups.empty)).toBeDefined();
        expect(await inviteButton()).toBeDefined();
        expect(screen.getByText(t('groups.links.hint', { days: INVITATION_DAYS }))).toBeDefined();
    });

    it('makes a link at once and shows it, with the day it stops working and the focus on it', async () => {
        const api = openGroups();

        fireEvent.click(await inviteButton());

        await waitFor(() => expect(linkFields()).toHaveLength(1));
        const [made] = api.pendingInvitations;
        if (!made) throw new Error('No link was made');
        const [field] = linkFields();
        expect(field?.value).toBe(urlOf(made));
        expect(field?.readOnly).toBe(true);
        await waitFor(() => expect(document.activeElement).toBe(field));
        expect(screen.getByText(t('groups.invite.until', { date: day(made.expiresAt) }))).toBeDefined();
        expect(screen.getByRole('heading', { name: en.groups.links.title })).toBeDefined();
        expect(api.groupRequests).toEqual(['POST /api/invitations']);
    });

    it('lists the open links of the person, newest first', async () => {
        const [newer, older] = [pendingLink(), pendingLink()];
        openGroups([newer, older]);

        await waitFor(() => expect(linkFields()).toHaveLength(2));
        expect(linkFields().map((field) => field.value)).toEqual([urlOf(newer), urlOf(older)]);
    });

    it('names the buttons of each link after the day it stops working, so two links can be told apart', async () => {
        const dayMs = 24 * 60 * 60 * 1000;
        const [soon, later] = [pendingLink(Date.now() + 2 * dayMs), pendingLink(Date.now() + 9 * dayMs)];
        const api = openGroups([soon, later]);
        const groupOf = (link: PendingInvitation) =>
            screen.findByRole('group', { name: t('groups.invite.until', { date: day(link.expiresAt) }) });

        const laterGroup = await groupOf(later);

        expect(within(await groupOf(soon)).getByRole<HTMLInputElement>('textbox').value).toBe(urlOf(soon));
        expect(within(laterGroup).getByRole<HTMLInputElement>('textbox').value).toBe(urlOf(later));
        fireEvent.click(within(laterGroup).getByRole('button', { name: en.groups.invite.revoke }));
        await waitFor(() => expect(api.groupRequests).toEqual([`DELETE /api/invitations/${later.id}`]));
    });

    it('copies a link', async () => {
        const link = pendingLink();
        const writeText = vi.fn(async () => undefined);
        Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
        openGroups([link]);

        fireEvent.click(await screen.findByRole('button', { name: en.groups.invite.copy }));

        expect(await screen.findByText(en.groups.invite.copied)).toBeDefined();
        expect(writeText).toHaveBeenCalledWith(urlOf(link));
    });

    it('revokes a link, and gives the focus back to Invite a friend', async () => {
        const [revoked, kept] = [pendingLink(), pendingLink()];
        const api = openGroups([revoked, kept]);
        await waitFor(() => expect(linkFields()).toHaveLength(2));

        const [revoke] = screen.getAllByRole('button', { name: en.groups.invite.revoke });
        fireEvent.click(revoke!);

        await waitFor(() => expect(linkFields().map((field) => field.value)).toEqual([urlOf(kept)]));
        await waitFor(async () => expect(document.activeElement).toBe(await inviteButton()));
        expect(api.groupRequests).toEqual([`DELETE /api/invitations/${revoked.id}`]);
    });

    it('says so in words when the person has as many open links as there can be', async () => {
        const api = openGroups();
        api.state.groupRefusal = { status: 409, error: 'too-many-invitations' };

        fireEvent.click(await inviteButton());

        expect((await screen.findByRole('alert')).textContent).toBe(
            t('groups.failure.tooManyInvitations', { max: MAX_OPEN_INVITATIONS })
        );
        expect(linkFields()).toEqual([]);
    });

    it('is off while offline, and sends nothing', async () => {
        const api = openGroups([pendingLink()]);
        await waitFor(() => expect(linkFields()).toHaveLength(1));

        act(() => onlineManager.setOnline(false));

        expect(await screen.findByText(en.groups.offline)).toBeDefined();
        expect((await inviteButton()).disabled).toBe(true);
        const revoke = screen.getByRole<HTMLButtonElement>('button', { name: en.groups.invite.revoke });
        expect(revoke.disabled).toBe(true);
        expect(api.groupRequests).toEqual([]);
    });

    it('says when the links could not be read, and can still make one', async () => {
        const api = createFakeApi();
        stubApi((url, init) => {
            const reads = url.pathname === '/api/invitations' && (init?.method ?? 'GET') === 'GET';
            return reads ? new Response(null, { status: 500 }) : api.handler(url, init);
        });
        renderApp({ path: '/groups' });

        expect(await screen.findByText(en.groups.links.loadFailed)).toBeDefined();
        fireEvent.click(await inviteButton());

        await waitFor(() => expect(linkFields()).toHaveLength(1));
    });
});
