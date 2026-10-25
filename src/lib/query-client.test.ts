import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api';

import { createQueryClient } from './query-client';

import type { QueryClient } from '@tanstack/react-query';

async function failQuery(client: QueryClient, error: unknown) {
    await client.fetchQuery({ queryKey: ['x'], queryFn: () => Promise.reject(error) }).catch(() => undefined);
}

async function failMutation(client: QueryClient, error: unknown) {
    await client
        .getMutationCache()
        .build(client, { mutationFn: () => Promise.reject(error) })
        .execute(undefined)
        .catch(() => undefined);
}

describe('query client', () => {
    it.each([
        ['query', failQuery],
        ['mutation', failMutation],
    ])('reports a 401 from a %s', async (_kind, fail) => {
        const onUnauthorized = vi.fn();

        await fail(createQueryClient({ onUnauthorized }), new ApiError(401));

        expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['another status', new ApiError(403)],
        ['a server error', new ApiError(500)],
        ['a dropped connection', new TypeError('Failed to fetch')],
    ])('does not report %s', async (_name, error) => {
        const onUnauthorized = vi.fn();
        const client = createQueryClient({ onUnauthorized });

        await failQuery(client, error);
        await failMutation(client, error);

        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('works with nobody to tell', async () => {
        await expect(failQuery(createQueryClient(), new ApiError(401))).resolves.toBeUndefined();
    });
});
