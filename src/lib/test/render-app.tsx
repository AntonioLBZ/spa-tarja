import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { vi } from 'vitest';

import { useGroupOutbox, useOutbox, type KeyValueStorage, type Outbox, type PendingEntry } from '@/lib/offline';
import { createFakeAuth } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { AppProviders } from '@/providers';
import { createAppRouter } from '@/router';

import type { Expense } from '@core/expense';

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

// Unmatched requests fail loudly instead of reaching the network
const stubApi = (handler: Handler) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input), 'http://localhost');
        return handler(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
};

interface UserData {
    outbox: Outbox<Expense>;
    groupOutbox: Outbox<PendingEntry>;
    queryClient: QueryClient;
}

interface ProbeProps {
    onData: (data: UserData) => void;
}

// Hands the test the outboxes and the query client the signed-in user got
const Probe = (props: ProbeProps) => {
    const { onData } = props;
    const outbox = useOutbox();
    const groupOutbox = useGroupOutbox();
    const queryClient = useQueryClient();
    useEffect(() => {
        onData({ outbox, groupOutbox, queryClient });
    }, [onData, outbox, groupOutbox, queryClient]);
    return null;
};

// The app as it is mounted for real, over memory storage and a fake sign-in. Signed in as the test user unless told so.
// `outbox`, `groupOutbox` and `queryClient` exist once somebody is signed in.
const renderApp = ({
    path = '/',
    storage = createMemoryStorage(),
    fakeAuth = createFakeAuth(),
}: { path?: string; storage?: KeyValueStorage; fakeAuth?: ReturnType<typeof createFakeAuth> } = {}) => {
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
        get groupOutbox() {
            return data!.groupOutbox;
        },
        get queryClient() {
            return data!.queryClient;
        },
    };
};

export { renderApp, stubApi, type Handler };
