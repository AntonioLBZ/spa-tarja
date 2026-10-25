import { QueryClient } from '@tanstack/react-query';

function createQueryClient() {
    return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, staleTime: 60_000, retry: false } } });
}

export { createQueryClient };
