import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n';
import { createQueryClient } from '@/lib/query-client';
import { createAppRouter } from '@/router';

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

// Unmatched requests fail loudly instead of reaching the network
function stubApi(handler: Handler) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
        return handler(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

function renderApp({ path = '/' }: { path?: string } = {}) {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
    const queryClient = createQueryClient();
    return render(
        <LocaleProvider>
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </LocaleProvider>
    );
}

export { renderApp, stubApi };
export type { Handler };
