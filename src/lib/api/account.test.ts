import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeApi } from '@/lib/test/fake-api';
import { TEST_USER } from '@/lib/test/fake-auth';
import { stubApi } from '@/lib/test/render-app';

import { deleteAccount } from './account';
import { ApiError } from './api-error';

function open() {
    const api = createFakeApi();
    stubApi(api.handler);
    return api;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('deleteAccount', () => {
    it('sends the email typed to confirm, and the account is gone', async () => {
        const api = open();

        await deleteAccount(TEST_USER.email);

        expect(api.accountDeletions).toEqual([{ email: TEST_USER.email }]);
        expect(api.state.unauthorized).toBe(true);
    });

    it('throws an ApiError with the status and the code when the server refuses', async () => {
        const api = open();

        const refusal = deleteAccount('bruno@example.com');

        await expect(refusal).rejects.toBeInstanceOf(ApiError);
        await expect(refusal).rejects.toMatchObject({ status: 422, code: 'wrong-email' });
        expect(api.state.unauthorized).toBe(false);
    });

    it('throws an ApiError when the server fails', async () => {
        const api = open();
        api.state.accountDeleteStatus = 503;

        await expect(deleteAccount(TEST_USER.email)).rejects.toMatchObject({ status: 503 });
        expect(api.accountDeletions).toEqual([{ email: TEST_USER.email }]);
        expect(api.state.unauthorized).toBe(false);
    });
});
