import { AuthGate } from '@/features/auth/auth-gate';
import { AuthProvider } from '@/lib/auth';
import { UserDataProvider } from '@/lib/offline';
import { createFakeApi } from '@/lib/test/fake-api';
import { createFakeAuth } from '@/lib/test/fake-auth';
import { createMemoryStorage } from '@/lib/test/memory-storage';
import { useLayoutEffect, useState, type ReactNode } from 'react';

import type { Expense } from '@core/expense';

type FakeApi = ReturnType<typeof createFakeApi>;
type FakeApiOptions = NonNullable<Parameters<typeof createFakeApi>[0]>;

// What the screens of the app read, with nothing real behind it: a signed-in person (as in the tests), memory instead
// of IndexedDB, and a fake server that answers `/api/*`. Anything else goes to the network as usual.
function AppData(props: { api?: FakeApiOptions; children: (api: FakeApi) => ReactNode }) {
    const { api: options, children } = props;
    const [stage] = useState(() => ({
        api: createFakeApi(options),
        auth: createFakeAuth(),
        storage: createMemoryStorage(),
    }));

    useLayoutEffect(() => {
        const real = globalThis.fetch;
        globalThis.fetch = async (input, init) => {
            const url = new URL(input instanceof Request ? input.url : String(input), location.origin);
            return url.pathname.startsWith('/api/') ? stage.api.handler(url, init) : real(input, init);
        };
        return () => {
            globalThis.fetch = real;
        };
    }, [stage]);

    return (
        <AuthProvider auth={stage.auth.auth}>
            <AuthGate>
                <UserDataProvider storage={stage.storage}>{children(stage.api)}</UserDataProvider>
            </AuthGate>
        </AuthProvider>
    );
}

// An expense of the person, made on `date`; what a story needs to say is what it passes in `rest`
function sampleExpense(id: string, date: string, rest: Partial<Expense> = {}): Expense {
    return {
        id,
        categoryId: 'food',
        text: 'Lunch with Marta',
        amountCents: 1850,
        currency: 'EUR',
        date,
        createdAt: Date.parse(`${date}T12:00:00Z`),
        updatedAt: Date.parse(`${date}T12:00:00Z`),
        deletedAt: null,
        ...rest,
    };
}

export { AppData, sampleExpense };
