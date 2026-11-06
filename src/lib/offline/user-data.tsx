import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createContext, use, useLayoutEffect, useState, type ReactNode } from 'react';

import { bindApiUser } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { createQueryClient } from '@/lib/query-client';

import { GROUP_OUTBOX_STORAGE_KEY, OUTBOX_STORAGE_KEY, createOutbox, type PendingEntry } from './outbox';
import { OutboxProvider } from './outbox-context';
import { createPersistOptions } from './persister';
import { createUserStorage } from './user-storage';

import type { KeyValueStorage } from './storage';
import type { Expense } from '@core/expense';

interface UserData {
    // Deletes what the signed-in user keeps on this device
    discard: () => Promise<void>;
}

const UserDataContext = createContext<UserData | null>(null);

interface UserDataProviderProps {
    storage: KeyValueStorage;
    children: ReactNode;
}

// The outboxes and the cache of the signed-in user, kept on the device apart from any other account's
const UserDataProvider = (props: UserDataProviderProps) => {
    const { storage, children } = props;
    const user = useUser();
    const { check } = useAuth();
    const [data] = useState(() => {
        const mine = createUserStorage(storage, user.id);
        return {
            outbox: createOutbox<Expense>(mine.storage, OUTBOX_STORAGE_KEY),
            groupOutbox: createOutbox<PendingEntry>(mine.storage, GROUP_OUTBOX_STORAGE_KEY),
            queryClient: createQueryClient({ onUnauthorized: check }),
            persistOptions: createPersistOptions(mine.storage),
            userData: { discard: mine.discard },
        };
    });

    // Every call says it is for this user, and what this window had waiting to be sent stops with it
    useLayoutEffect(() => {
        const unbind = bindApiUser(user.id);
        data.outbox.resume();
        data.groupOutbox.resume();
        return () => {
            unbind();
            data.outbox.pause();
            data.groupOutbox.pause();
        };
    }, [user.id, data]);

    return (
        <UserDataContext value={data.userData}>
            <OutboxProvider outbox={data.outbox} groupOutbox={data.groupOutbox}>
                <PersistQueryClientProvider client={data.queryClient} persistOptions={data.persistOptions}>
                    {children}
                </PersistQueryClientProvider>
            </OutboxProvider>
        </UserDataContext>
    );
};

const useUserData = (): UserData => {
    const userData = use(UserDataContext);
    if (userData === null) throw new Error('useUserData needs a UserDataProvider');
    return userData;
};

export { UserDataProvider, useUserData, type UserDataProviderProps };
