import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, use, useState, type ReactNode } from 'react';

import { useAuth, useUser } from '@/lib/auth';
import { createQueryClient } from '@/lib/query-client';

import { createOutbox } from './outbox';
import { OutboxProvider } from './outbox-context';
import { createPersistOptions } from './persister';
import { createUserStorage } from './user-storage';

import type { KeyValueStorage } from './storage';

interface UserData {
    // Deletes what the signed-in user keeps on this device
    discard: () => Promise<void>;
}

const UserDataContext = createContext<UserData | null>(null);

// The outbox and the cache of the signed-in user, kept on the device apart from any other account's
function UserDataProvider(props: { storage: KeyValueStorage; children: ReactNode }) {
    const { storage, children } = props;
    const user = useUser();
    const { check } = useAuth();
    const [data] = useState(() => {
        const mine = createUserStorage(storage, user.id);
        return {
            outbox: createOutbox(mine.storage),
            queryClient: createQueryClient({ onUnauthorized: check }),
            persistOptions: createPersistOptions(mine.storage),
            userData: { discard: mine.discard },
        };
    });

    return (
        <UserDataContext value={data.userData}>
            <OutboxProvider outbox={data.outbox}>
                <PersistQueryClientProvider client={data.queryClient} persistOptions={data.persistOptions}>
                    {children}
                </PersistQueryClientProvider>
            </OutboxProvider>
        </UserDataContext>
    );
}

function useUserData(): UserData {
    const userData = use(UserDataContext);
    if (userData === null) throw new Error('useUserData needs a UserDataProvider');
    return userData;
}

export { UserDataProvider, useUserData };
