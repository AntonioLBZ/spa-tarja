import { afterEach, describe, expect, it, vi } from 'vitest';

import { sampleGroup } from '@/lib/test/groups';
import { stubApi } from '@/lib/test/render-app';

import { ApiError } from './api-error';
import {
    acceptInvitation,
    declineInvitation,
    deleteFriendInvitation,
    fetchFriendInvitation,
    postFriendInvitation,
    readInvitation,
} from './invitations';

import type { FriendInvitation } from '@core/invitation';

const TOKEN = `0b6f3c1e-8d2a-4c5b-9e7f-1a2b3c4d5e6f.${'A'.repeat(43)}`;
const OPEN: FriendInvitation = { state: 'open', token: TOKEN, expiresAt: 1_000 };

function answering(body: unknown, status = 200) {
    return stubApi(() => (status === 204 ? new Response(null, { status }) : Response.json(body, { status })));
}

function sent(fetchMock: ReturnType<typeof stubApi>) {
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    return {
        url: String(input),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : null,
    };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('the invitation of a friend', () => {
    it('is read, made and revoked under the friend', async () => {
        const read = answering({ invitation: OPEN });
        expect(await fetchFriendInvitation('friend-1')).toEqual(OPEN);
        expect(sent(read)).toMatchObject({ url: '/api/groups/friend-1/invitations', method: 'GET' });

        const made = answering({ invitation: OPEN });
        expect(await postFriendInvitation('friend-1')).toEqual(OPEN);
        expect(sent(made)).toMatchObject({ url: '/api/groups/friend-1/invitations', method: 'POST' });

        const revoked = answering({ invitation: null });
        expect(await deleteFriendInvitation('friend-1')).toBeNull();
        expect(sent(revoked)).toMatchObject({ url: '/api/groups/friend-1/invitations', method: 'DELETE' });
    });

    it('carries the reason of a refusal', async () => {
        answering({ error: 'not-placeholder' }, 409);

        await expect(postFriendInvitation('friend-1')).rejects.toMatchObject({ status: 409, code: 'not-placeholder' });
        await expect(postFriendInvitation('friend-1')).rejects.toBeInstanceOf(ApiError);
    });
});

describe('a link', () => {
    it('is read, accepted and declined with its token in the body, never in the URL', async () => {
        const group = sampleGroup({ kind: 'direct', name: null });

        const read = answering({ name: 'Ana' });
        expect(await readInvitation(TOKEN)).toEqual({ name: 'Ana' });
        expect(sent(read)).toEqual({ url: '/api/invitations/read', method: 'POST', body: { token: TOKEN } });

        const accepted = answering(group);
        expect(await acceptInvitation(TOKEN)).toEqual(group);
        expect(sent(accepted)).toEqual({ url: '/api/invitations/accept', method: 'POST', body: { token: TOKEN } });

        const declined = answering(null, 204);
        expect(await declineInvitation(TOKEN)).toBeUndefined();
        expect(sent(declined)).toEqual({ url: '/api/invitations/decline', method: 'POST', body: { token: TOKEN } });
    });

    it.each([
        ['read', readInvitation],
        ['accepted', acceptInvitation],
        ['declined', declineInvitation],
    ])('carries the reason when it cannot be %s', async (_, call) => {
        answering({ error: 'gone' }, 410);

        await expect(call(TOKEN)).rejects.toMatchObject({ status: 410, code: 'gone' });
    });
});
