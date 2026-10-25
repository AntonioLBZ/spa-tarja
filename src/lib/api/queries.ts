import { queryOptions } from '@tanstack/react-query';

import { api } from './client';

function healthQuery() {
    return queryOptions({
        queryKey: ['health'],
        queryFn: async () => {
            const response = await api.api.health.$get();
            if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
            return response.json();
        },
    });
}

export { healthQuery };
