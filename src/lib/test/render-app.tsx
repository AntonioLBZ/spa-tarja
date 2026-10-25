import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { vi } from 'vitest';

import { useOutbox, type KeyValueStorage, type Outbox } from '@/lib/offline';
import { createFakeAuth } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { AppProviders } from '@/providers';
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

interface UserData {
    outbox: Outbox;
    queryClient: QueryClient;
}

// Hands the test the outbox and the query client the signed-in user got
function Probe(props: { onData: (data: UserData) => void }) {
    const { onData } = props;
    const outbox = useOutbox();
    const queryClient = useQueryClient();
    useEffect(() => {
        onData({ outbox, queryClient });
    }, [onData, outbox, queryClient]);
    return null;
}

// The app as `main.tsx` mounts it, over memory storage and a fake sign-in. Signed in as the test user unless told so.
// `outbox` and `queryClient` exist once somebody is signed in.
function renderApp({
    path = '/',
    storage = createMemoryStorage(),
    fakeAuth = createFakeAuth(),
}: { path?: string; storage?: KeyValueStorage; fakeAuth?: ReturnType<typeof createFakeAuth> } = {}) {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }));
    let data: UserData | undefined;
    const rendered = render(
        <AppProviders auth={fakeAuth.auth} storage={storage}>
            <RouterProvider router={router} />
            <Probe onData={(next) => (data = next)} />
        </AppProviders>
    );
    return {
        ...rendered,
        storage,
        fakeAuth,
        get outbox() {
            return data!.outbox;
        },
        get queryClient() {
            return data!.queryClient;
        },
    };
}

export { renderApp, stubApi };
export type { Handler };
