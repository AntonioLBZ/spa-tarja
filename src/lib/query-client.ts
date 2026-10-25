import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api';

interface QueryClientOptions {
    // The server answered 401: the session may be over, which only the auth check can tell
    onUnauthorized?: () => void;
}

function createQueryClient(options: QueryClientOptions = {}) {
    const { onUnauthorized } = options;
    const onError = (error: unknown) => {
        if (error instanceof ApiError && error.status === 401) onUnauthorized?.();
    };

    return new QueryClient({
        queryCache: new QueryCache({ onError }),
        mutationCache: new MutationCache({ onError }),
        defaultOptions: { queries: { gcTime: Infinity, staleTime: 60_000, retry: false } },
    });
}

export { createQueryClient };
