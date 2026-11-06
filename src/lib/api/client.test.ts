import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFakeApi } from '@/lib/test/fake-api';
import { stubApi } from '@/lib/test/render-app';
import { USER_HEADER } from '@core/account';

import { api, bindApiUser, fetchAsUser } from './client';
import { fetchChanges } from './expenses';

const users = (fake: ReturnType<typeof createFakeApi>) => fake.requestUsers.map((entry) => entry.user);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('the user a call is made for', () => {
    it('is named on every call to the API once a user is bound', async () => {
        const fake = createFakeApi();
        stubApi(fake.handler);
        const unbind = bindApiUser('user-ana');

        await fetchChanges(0);
        await fetchChanges(0);

        expect(users(fake)).toEqual(['user-ana', 'user-ana']);
        unbind();
    });

    it('is named by nobody before a user is bound and after the binding ends', async () => {
        const fake = createFakeApi();
        stubApi(fake.handler);

        await fetchChanges(0);
        bindApiUser('user-ana')();
        await fetchChanges(0);

        expect(users(fake)).toEqual([null, null]);
    });

    it('follows the user bound last, and the end of an older binding leaves it alone', async () => {
        const fake = createFakeApi();
        stubApi(fake.handler);
        const first = bindApiUser('user-ana');
        const second = bindApiUser('user-bea');

        first();
        await fetchChanges(0);
        second();
        await fetchChanges(0);

        expect(users(fake)).toEqual(['user-bea', null]);
    });

    it('is not named on the health check', async () => {
        const fake = createFakeApi();
        stubApi(fake.handler);
        const unbind = bindApiUser('user-ana');

        await api.api.health.$get();

        expect(users(fake)).toEqual([null]);
        unbind();
    });

    it.each(['/api/auth/get-session?disableCookieCache=true', '/api/auth/sign-in/social', '/api/health'])(
        'is not named on %s',
        async (path) => {
            const fake = createFakeApi();
            stubApi(fake.handler);
            const unbind = bindApiUser('user-ana');

            await fetchAsUser(path);

            expect(users(fake)).toEqual([null]);
            unbind();
        }
    );

    it('is named beside the headers the call already has', async () => {
        const fake = createFakeApi();
        const seen: Array<string | null> = [];
        stubApi((url, init) => {
            seen.push(new Headers(init?.headers).get('content-type'), new Headers(init?.headers).get(USER_HEADER));
            return fake.handler(url, init);
        });
        const unbind = bindApiUser('user-ana');

        await fetchAsUser('/api/expenses', { headers: { 'content-type': 'application/json' } });

        expect(seen).toEqual(['application/json', 'user-ana']);
        unbind();
    });
});
