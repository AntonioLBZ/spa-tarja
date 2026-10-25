import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

import { LocaleProvider } from '@/lib/i18n';
import { OutboxProvider, createOutbox, type Outbox } from '@/lib/offline';
import { createQueryClient } from '@/lib/query-client';
import { createMemoryStorage } from '@/lib/test/memory-storage';
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

function renderApp({
    path = '/',
    outbox = createOutbox(createMemoryStorage()),
}: { path?: string; outbox?: Outbox } = {}) {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
    const queryClient = createQueryClient();
    const rendered = render(
        <LocaleProvider>
            <OutboxProvider outbox={outbox}>
                <QueryClientProvider client={queryClient}>
                    <RouterProvider router={router} />
                </QueryClientProvider>
            </OutboxProvider>
        </LocaleProvider>
    );
    return { ...rendered, outbox, queryClient };
}

export { renderApp, stubApi };
export type { Handler };
