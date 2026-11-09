import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { stubApi } from '@/lib/test/render-app';

import { ApiError } from './api-error';
import { fetchProfile, putProfile } from './profile';

function open(nickname: string | null = null) {
    const api = createFakeApi({ nickname });
    stubApi(api.handler);
    return api;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('fetchProfile', () => {
    it('reads the nickname and the name of the account', async () => {
        open('Anita');

        expect(await fetchProfile()).toEqual({ nickname: 'Anita', name: TEST_USER.name });
    });

    it('throws an ApiError with the status when the server refuses', async () => {
        const api = open();
        api.state.unauthorized = true;

        await expect(fetchProfile()).rejects.toMatchObject({ status: 401 });
        await expect(fetchProfile()).rejects.toBeInstanceOf(ApiError);
    });
});

describe('putProfile', () => {
    it('sends the nickname and answers with the profile the server kept', async () => {
        const api = open();

        expect(await putProfile({ nickname: ' Anita ' })).toEqual({ nickname: 'Anita', name: TEST_USER.name });
        expect(api.profileBodies).toEqual([{ nickname: ' Anita ' }]);
        expect(api.profile.nickname).toBe('Anita');
    });

    it('sends null to take the nickname away', async () => {
        const api = open('Anita');

        expect(await putProfile({ nickname: null })).toEqual({ nickname: null, name: TEST_USER.name });
        expect(api.profile.nickname).toBeNull();
    });

    it('throws an ApiError with the status when the server refuses', async () => {
        const api = open('Anita');
        api.state.profileWriteStatus = 503;

        await expect(putProfile({ nickname: 'Ana' })).rejects.toMatchObject({ status: 503 });
        expect(api.profile.nickname).toBe('Anita');
    });

    it('is refused like the Worker refuses a nickname of only spaces', async () => {
        open();

        await expect(putProfile({ nickname: '   ' })).rejects.toMatchObject({ status: 400 });
    });
});
